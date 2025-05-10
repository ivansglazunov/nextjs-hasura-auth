import * as echarts from 'echarts';
import { useEffect, useRef, useState } from 'react';

export function ECharts({ options }: { options: echarts.EChartsOption }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [chart, setChart] = useState<echarts.ECharts | null>(null);

  useEffect(() => {
    if (chartRef.current) {
      const chart = echarts.init(chartRef.current);
      setChart(chart);
    }
  }, []);

  useEffect(() => {
    if (chart) {
      chart.setOption(options);
    }
  }, [options, chart]);
  
  return <div ref={chartRef} />;
}
