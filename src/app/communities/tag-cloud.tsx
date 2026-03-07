"use client";

import { useRef, useEffect, useState } from "react";
import * as d3 from "d3";
import Link from "next/link";

interface TagData {
  name: string;
  count: number;
}

interface TagCloudProps {
  tags: TagData[];
}

interface BubbleNode extends d3.SimulationNodeDatum {
  name: string;
  count: number;
  radius: number;
}

export function TagCloud({ tags }: TagCloudProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<BubbleNode[]>([]);
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });

  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const width = entry.contentRect.width;
        const height = Math.max(300, Math.min(500, width * 0.65));
        setDimensions({ width, height });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (tags.length === 0 || dimensions.width === 0) return;

    const maxCount = Math.max(...tags.map((t) => t.count));
    const minCount = Math.min(...tags.map((t) => t.count));

    const radiusScale = d3
      .scaleSqrt()
      .domain([minCount, maxCount])
      .range([20, Math.min(60, dimensions.width / 8)]);

    const bubbleNodes: BubbleNode[] = tags.map((tag) => ({
      name: tag.name,
      count: tag.count,
      radius: radiusScale(tag.count),
      x: dimensions.width / 2 + (Math.random() - 0.5) * 100,
      y: dimensions.height / 2 + (Math.random() - 0.5) * 100,
    }));

    const simulation = d3
      .forceSimulation(bubbleNodes)
      .force("center", d3.forceCenter(dimensions.width / 2, dimensions.height / 2))
      .force(
        "collision",
        d3.forceCollide<BubbleNode>((d) => d.radius + 3).strength(1)
      )
      .force("charge", d3.forceManyBody().strength(5))
      .force(
        "x",
        d3.forceX(dimensions.width / 2).strength(0.05)
      )
      .force(
        "y",
        d3.forceY(dimensions.height / 2).strength(0.05)
      );

    simulation.on("tick", () => {
      // Constrain nodes within bounds
      for (const node of bubbleNodes) {
        node.x = Math.max(
          node.radius,
          Math.min(dimensions.width - node.radius, node.x ?? 0)
        );
        node.y = Math.max(
          node.radius,
          Math.min(dimensions.height - node.radius, node.y ?? 0)
        );
      }
      setNodes([...bubbleNodes]);
    });

    simulation.alpha(0.8).restart();

    return () => {
      simulation.stop();
    };
  }, [tags, dimensions]);

  const maxCount = Math.max(...tags.map((t) => t.count), 1);
  const colorScale = d3
    .scaleSequential(d3.interpolateWarm)
    .domain([0, maxCount]);

  return (
    <div ref={containerRef} className="relative w-full" data-testid="tag-cloud">
      <svg
        width={dimensions.width}
        height={dimensions.height}
        className="overflow-visible"
      >
        {nodes.map((node) => (
          <g
            key={node.name}
            transform={`translate(${node.x ?? 0},${node.y ?? 0})`}
          >
            <Link href={`/tag/${node.name}`}>
              <circle
                r={node.radius}
                fill={colorScale(node.count)}
                opacity={0.85}
                className="cursor-pointer transition-opacity hover:opacity-100"
                stroke="white"
                strokeWidth={2}
              />
              <text
                textAnchor="middle"
                dy="0.1em"
                className="pointer-events-none select-none fill-white text-xs font-semibold"
                style={{
                  fontSize: `${Math.max(9, node.radius / 3.5)}px`,
                }}
              >
                #{node.name}
              </text>
              <text
                textAnchor="middle"
                dy={`${node.radius / 4 + 6}px`}
                className="pointer-events-none select-none fill-white/80"
                style={{
                  fontSize: `${Math.max(7, node.radius / 5)}px`,
                }}
              >
                {node.count}
              </text>
            </Link>
          </g>
        ))}
      </svg>
    </div>
  );
}
