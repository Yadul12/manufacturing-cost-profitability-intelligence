import React, { useEffect, useRef } from 'react';
import Plotly from 'plotly.js-dist-min';

export interface PlotlyChartProps {
  data: any[];
  layout?: Record<string, any>;
  config?: Record<string, any>;
  height?: number;
  isDark?: boolean;
  className?: string;
}

export const PlotlyChart: React.FC<PlotlyChartProps> = ({
  data,
  layout = {},
  config = {},
  height = 340,
  isDark = true,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const textColor = isDark ? '#cbd5e1' : '#334155';
    const mutedColor = isDark ? '#64748b' : '#94a3b8';
    const gridColor = isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(148, 163, 184, 0.22)';
    const zeroLineColor = isDark ? 'rgba(148, 163, 184, 0.25)' : 'rgba(148, 163, 184, 0.35)';

    const mergedLayout: Record<string, any> = {
      autosize: true,
      height,
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: {
        family: "'Public Sans', -apple-system, BlinkMacSystemFont, sans-serif",
        size: 11.5,
        color: textColor,
      },
      margin: { t: 28, r: 20, b: 48, l: 58, ...(layout.margin || {}) },
      xaxis: {
        gridcolor: gridColor,
        zerolinecolor: zeroLineColor,
        tickfont: { family: "'JetBrains Mono', monospace", size: 10.5, color: mutedColor },
        titlefont: { size: 11.5, color: textColor },
        ...(layout.xaxis || {}),
      },
      yaxis: {
        gridcolor: gridColor,
        zerolinecolor: zeroLineColor,
        tickfont: { family: "'JetBrains Mono', monospace", size: 10.5, color: mutedColor },
        titlefont: { size: 11.5, color: textColor },
        ...(layout.yaxis || {}),
      },
      legend: {
        orientation: 'h',
        yanchor: 'bottom',
        y: 1.02,
        xanchor: 'right',
        x: 1,
        font: { size: 11, color: textColor },
        bgcolor: 'rgba(0,0,0,0)',
        ...(layout.legend || {}),
      },
      hoverlabel: {
        bgcolor: isDark ? '#0f172a' : '#ffffff',
        bordercolor: isDark ? '#334155' : '#cbd5e1',
        font: {
          family: "'JetBrains Mono', monospace",
          size: 11.5,
          color: isDark ? '#f8fafc' : '#0f172a',
        },
      },
      ...layout,
    };

    // Preserve merged nested axis/margin properties
    if (layout.margin) mergedLayout.margin = { t: 28, r: 20, b: 48, l: 58, ...layout.margin };
    if (layout.xaxis) {
      mergedLayout.xaxis = {
        gridcolor: gridColor,
        zerolinecolor: zeroLineColor,
        tickfont: { family: "'JetBrains Mono', monospace", size: 10.5, color: mutedColor },
        ...layout.xaxis,
      };
    }
    if (layout.yaxis) {
      mergedLayout.yaxis = {
        gridcolor: gridColor,
        zerolinecolor: zeroLineColor,
        tickfont: { family: "'JetBrains Mono', monospace", size: 10.5, color: mutedColor },
        ...layout.yaxis,
      };
    }
    if (layout.yaxis2) {
      mergedLayout.yaxis2 = {
        gridcolor: 'rgba(0,0,0,0)',
        zerolinecolor: zeroLineColor,
        tickfont: { family: "'JetBrains Mono', monospace", size: 10.5, color: mutedColor },
        ...layout.yaxis2,
      };
    }

    const mergedConfig: Record<string, any> = {
      responsive: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d'],
      ...config,
    };

    Plotly.react(el, data, mergedLayout, mergedConfig);

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current) {
        Plotly.Plots.resize(containerRef.current);
      }
    });
    resizeObserver.observe(el);

    return () => {
      resizeObserver.disconnect();
    };
  }, [data, layout, config, height, isDark]);

  return (
    <div
      ref={containerRef}
      className={`w-full overflow-hidden ${className}`}
      style={{ minHeight: `${height}px` }}
    />
  );
};
