import type { ChartConfig } from '../types';

export interface ChartDimensions {
  width: number;
  height: number;
  padding: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

export interface StackedAreaData {
  sessionId: string;
  color: string;
  /** Per-bucket counts (same length as dataPoints) */
  values: number[];
}

export class ChartRenderer {
  private ctx: CanvasRenderingContext2D;
  private dimensions: ChartDimensions;
  private config: ChartConfig;
  private animationId: number | null = null;

  // Smooth animation: interpolated stacked area heights per session per bucket
  private currentHeights: number[][] = []; // [sessionIdx][bucketIdx]
  private targetHeights: number[][] = [];
  private lerpSpeed = 0.14;

  constructor(
    canvas: HTMLCanvasElement,
    dimensions: ChartDimensions,
    config: ChartConfig
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');

    this.ctx = ctx;
    this.dimensions = dimensions;
    this.config = config;
    this.setupCanvas(canvas);
  }

  private setupCanvas(canvas: HTMLCanvasElement) {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = this.dimensions.width * dpr;
    canvas.height = this.dimensions.height * dpr;
    canvas.style.width = `${this.dimensions.width}px`;
    canvas.style.height = `${this.dimensions.height}px`;
    this.ctx.scale(dpr, dpr);
  }

  private getChartArea() {
    const { width, height, padding } = this.dimensions;
    return {
      x: padding.left,
      y: padding.top,
      width: width - padding.left - padding.right,
      height: height - padding.top - padding.bottom
    };
  }

  clear() {
    this.ctx.clearRect(0, 0, this.dimensions.width, this.dimensions.height);
  }

  drawBackground() {
    const chartArea = this.getChartArea();
    const gradient = this.ctx.createLinearGradient(
      chartArea.x, chartArea.y,
      chartArea.x, chartArea.y + chartArea.height
    );
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.01)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.04)');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(chartArea.x, chartArea.y, chartArea.width, chartArea.height);
  }

  drawAxes(maxValue: number) {
    const chartArea = this.getChartArea();

    // Dashed horizontal grid lines with Y-axis labels
    const gridLineCount = 3;
    this.ctx.save();

    for (let i = 1; i <= gridLineCount; i++) {
      const fraction = i / gridLineCount;
      const y = chartArea.y + chartArea.height * (1 - fraction);

      // Grid line
      this.ctx.strokeStyle = this.config.colors.axis;
      this.ctx.lineWidth = 0.5;
      this.ctx.setLineDash([3, 4]);
      this.ctx.globalAlpha = 0.3;
      this.ctx.beginPath();
      this.ctx.moveTo(chartArea.x, y);
      this.ctx.lineTo(chartArea.x + chartArea.width, y);
      this.ctx.stroke();

      // Y-axis label
      if (maxValue > 0) {
        const labelValue = Math.round(maxValue * fraction);
        this.ctx.setLineDash([]);
        this.ctx.globalAlpha = 0.45;
        this.ctx.fillStyle = this.config.colors.text;
        this.ctx.font = '9px "Inter", system-ui, sans-serif';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'bottom';
        this.ctx.fillText(String(labelValue), chartArea.x + 2, y - 2);
      }
    }

    this.ctx.restore();

    // Bottom axis line
    this.ctx.save();
    this.ctx.strokeStyle = this.config.colors.axis;
    this.ctx.lineWidth = 0.5;
    this.ctx.globalAlpha = 0.5;
    this.ctx.beginPath();
    this.ctx.moveTo(chartArea.x, chartArea.y + chartArea.height);
    this.ctx.lineTo(chartArea.x + chartArea.width, chartArea.y + chartArea.height);
    this.ctx.stroke();
    this.ctx.restore();
  }

  drawTimeLabels(timeRange: string) {
    const chartArea = this.getChartArea();
    this.ctx.save();
    this.ctx.fillStyle = this.config.colors.text;
    this.ctx.globalAlpha = 0.55;
    this.ctx.font = '10px "Inter", system-ui, -apple-system, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'top';

    const labels = this.getTimeLabels(timeRange);
    const spacing = chartArea.width / (labels.length - 1);

    labels.forEach((label, index) => {
      const x = chartArea.x + (index * spacing);
      const y = chartArea.y + chartArea.height + 6;
      this.ctx.fillText(label, x, y);
    });
    this.ctx.restore();
  }

  private getTimeLabels(timeRange: string): string[] {
    switch (timeRange) {
      case '1m': return ['60s', '45s', '30s', '15s', 'now'];
      case '3m': return ['3m', '2m', '1m', 'now'];
      case '5m': return ['5m', '4m', '3m', '2m', '1m', 'now'];
      case '10m': return ['10m', '8m', '6m', '4m', '2m', 'now'];
      default: return [];
    }
  }

  /**
   * Update target heights for smooth stacked area animation.
   * stackedData: array of per-session series, each with values[] per bucket.
   * maxValue: the max total (sum of all sessions) across all buckets.
   */
  updateTargetHeights(stackedData: StackedAreaData[], maxValue: number) {
    const chartArea = this.getChartArea();

    const newTargets: number[][] = stackedData.map(series =>
      series.values.map(v => maxValue > 0 ? (v / maxValue) * chartArea.height : 0)
    );

    // Initialize if size changed
    if (
      this.currentHeights.length !== newTargets.length ||
      (newTargets.length > 0 && this.currentHeights[0]?.length !== newTargets[0].length)
    ) {
      this.currentHeights = newTargets.map(row => row.map(() => 0));
    }
    this.targetHeights = newTargets;
  }

  /**
   * Advance lerp interpolation. Returns true if still animating.
   */
  tickAnimation(): boolean {
    let stillAnimating = false;
    for (let s = 0; s < this.targetHeights.length; s++) {
      for (let b = 0; b < this.targetHeights[s].length; b++) {
        const target = this.targetHeights[s][b];
        const current = this.currentHeights[s]?.[b] ?? 0;
        const diff = target - current;
        if (Math.abs(diff) > 0.3) {
          if (!this.currentHeights[s]) this.currentHeights[s] = [];
          this.currentHeights[s][b] = current + diff * this.lerpSpeed;
          stillAnimating = true;
        } else {
          if (!this.currentHeights[s]) this.currentHeights[s] = [];
          this.currentHeights[s][b] = target;
        }
      }
    }
    return stillAnimating;
  }

  /**
   * Draw stacked area chart.
   * stackedData is ordered bottom-to-top (first series is at the bottom).
   */
  drawStackedAreas(stackedData: StackedAreaData[]) {
    if (stackedData.length === 0) return;

    const chartArea = this.getChartArea();
    const bucketCount = stackedData[0].values.length;
    if (bucketCount === 0) return;

    const baselineY = chartArea.y + chartArea.height;
    const stepX = chartArea.width / (bucketCount - 1 || 1);

    // Build cumulative stacked heights per bucket using animated values
    // cumulativeY[b] = the current top of the stack at bucket b
    const cumulativeY = new Array(bucketCount).fill(0);

    for (let s = 0; s < stackedData.length; s++) {
      const series = stackedData[s];
      const heights = this.currentHeights[s] || [];
      const prevCumulative = [...cumulativeY];

      // Update cumulative
      for (let b = 0; b < bucketCount; b++) {
        cumulativeY[b] += (heights[b] || 0);
      }

      // Draw filled area between prevCumulative and cumulativeY
      this.ctx.save();
      this.ctx.beginPath();

      // Top edge (left to right) — smoothed with quadratic curves
      const topPoints: { x: number; y: number }[] = [];
      for (let b = 0; b < bucketCount; b++) {
        topPoints.push({
          x: chartArea.x + b * stepX,
          y: baselineY - cumulativeY[b]
        });
      }

      this.ctx.moveTo(topPoints[0].x, topPoints[0].y);
      for (let i = 1; i < topPoints.length; i++) {
        const prev = topPoints[i - 1];
        const curr = topPoints[i];
        const cpx = (prev.x + curr.x) / 2;
        this.ctx.quadraticCurveTo(prev.x + (cpx - prev.x) * 0.8, prev.y, cpx, (prev.y + curr.y) / 2);
        this.ctx.quadraticCurveTo(curr.x - (curr.x - cpx) * 0.8, curr.y, curr.x, curr.y);
      }

      // Bottom edge (right to left) — the previous stack's top
      const bottomPoints: { x: number; y: number }[] = [];
      for (let b = 0; b < bucketCount; b++) {
        bottomPoints.push({
          x: chartArea.x + b * stepX,
          y: baselineY - prevCumulative[b]
        });
      }

      // Line to the last bottom point
      this.ctx.lineTo(bottomPoints[bottomPoints.length - 1].x, bottomPoints[bottomPoints.length - 1].y);

      // Trace bottom edge right to left with smooth curves
      for (let i = bottomPoints.length - 2; i >= 0; i--) {
        const prev = bottomPoints[i + 1];
        const curr = bottomPoints[i];
        const cpx = (prev.x + curr.x) / 2;
        this.ctx.quadraticCurveTo(prev.x - (prev.x - cpx) * 0.8, prev.y, cpx, (prev.y + curr.y) / 2);
        this.ctx.quadraticCurveTo(curr.x + (cpx - curr.x) * 0.8, curr.y, curr.x, curr.y);
      }

      this.ctx.closePath();

      // Fill with semi-transparent color
      const color = series.color;
      this.ctx.fillStyle = this.adjustColorOpacity(color, 0.35);
      this.ctx.fill();

      // Top edge stroke for definition
      this.ctx.beginPath();
      this.ctx.moveTo(topPoints[0].x, topPoints[0].y);
      for (let i = 1; i < topPoints.length; i++) {
        const prev = topPoints[i - 1];
        const curr = topPoints[i];
        const cpx = (prev.x + curr.x) / 2;
        this.ctx.quadraticCurveTo(prev.x + (cpx - prev.x) * 0.8, prev.y, cpx, (prev.y + curr.y) / 2);
        this.ctx.quadraticCurveTo(curr.x - (curr.x - cpx) * 0.8, curr.y, curr.x, curr.y);
      }
      this.ctx.strokeStyle = this.adjustColorOpacity(color, 0.8);
      this.ctx.lineWidth = 1.5;
      this.ctx.stroke();

      this.ctx.restore();
    }
  }

  /**
   * Draw a vertical crosshair line at the given x position.
   */
  drawCrosshair(x: number) {
    const chartArea = this.getChartArea();
    if (x < chartArea.x || x > chartArea.x + chartArea.width) return;

    this.ctx.save();
    this.ctx.strokeStyle = this.config.colors.text;
    this.ctx.globalAlpha = 0.3;
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([3, 3]);
    this.ctx.beginPath();
    this.ctx.moveTo(x, chartArea.y);
    this.ctx.lineTo(x, chartArea.y + chartArea.height);
    this.ctx.stroke();
    this.ctx.restore();
  }

  drawPulseEffect(x: number, y: number, radius: number, opacity: number) {
    const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, this.adjustColorOpacity(this.config.colors.primary, opacity * 0.6));
    gradient.addColorStop(0.5, this.adjustColorOpacity(this.config.colors.primary, opacity * 0.2));
    gradient.addColorStop(1, 'transparent');

    this.ctx.save();
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
  }

  private adjustColorOpacity(color: string, opacity: number): string {
    if (color.startsWith('#')) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbMatch) {
      return `rgba(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}, ${opacity})`;
    }
    return color;
  }

  animate(renderCallback: (progress: number) => void) {
    const startTime = performance.now();
    const frame = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / this.config.animationDuration, 1);
      renderCallback(this.easeOut(progress));
      if (progress < 1) {
        this.animationId = requestAnimationFrame(frame);
      } else {
        this.animationId = null;
      }
    };
    this.animationId = requestAnimationFrame(frame);
  }

  private easeOut(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  stopAnimation() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  resize(dimensions: ChartDimensions) {
    this.dimensions = dimensions;
    this.setupCanvas(this.ctx.canvas as HTMLCanvasElement);
  }
}

export function createChartRenderer(
  canvas: HTMLCanvasElement,
  dimensions: ChartDimensions,
  config: ChartConfig
): ChartRenderer {
  return new ChartRenderer(canvas, dimensions, config);
}
