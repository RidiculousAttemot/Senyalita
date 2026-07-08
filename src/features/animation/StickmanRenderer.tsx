"use client";

import React, { memo, useMemo } from "react";
import type { JointName, SkeletonPose } from "./types";
import { JOINT_NAMES } from "./types";

interface StickmanRendererProps {
  pose: SkeletonPose;
  width?: number;
  height?: number;
  strokeColor?: string;
  strokeWidth?: number;
  jointRadius?: number;
  showLabels?: boolean;
}

const VIEW_BOX = { x: -2, y: -2, w: 4, h: 4 };

const BONE_CONNECTIONS: [JointName, JointName][] = [
  ["head", "neck"],
  ["neck", "torso"],
  ["torso", "leftHip"],
  ["torso", "rightHip"],
  ["leftShoulder", "rightShoulder"],
  ["leftShoulder", "leftElbow"],
  ["rightShoulder", "rightElbow"],
  ["leftElbow", "leftWrist"],
  ["rightElbow", "rightWrist"],
  ["leftWrist", "leftHand"],
  ["rightWrist", "rightHand"],
  ["neck", "leftShoulder"],
  ["neck", "rightShoulder"],
  ["torso", "leftShoulder"],
  ["torso", "rightShoulder"],
];

function JointCircle({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return <circle cx={cx} cy={cy} r={r} fill="#fff" stroke="#333" strokeWidth={1.5} />;
}

function mapX(x: number, w: number): number {
  return ((x - VIEW_BOX.x) / VIEW_BOX.w) * w;
}

function mapY(y: number, h: number): number {
  return ((y - VIEW_BOX.y) / VIEW_BOX.h) * h;
}

const StickmanRenderer = memo(function StickmanRenderer({
  pose,
  width = 400,
  height = 500,
  strokeColor = "#3b82f6",
  strokeWidth = 3,
  jointRadius = 5,
  showLabels = false,
}: StickmanRendererProps) {
  const bones = useMemo(
    () =>
      BONE_CONNECTIONS.map(([from, to]) => {
        const a = pose.joints[from];
        const b = pose.joints[to];
        if (!a || !b) return null;
        return (
          <line
            key={`${from}-${to}`}
            x1={mapX(a.x, width)}
            y1={mapY(a.y, height)}
            x2={mapX(b.x, width)}
            y2={mapY(b.y, height)}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        );
      }),
    [pose, width, height, strokeColor, strokeWidth],
  );

  const joints = useMemo(
    () =>
      JOINT_NAMES.map((name) => {
        const j = pose.joints[name];
        if (!j) return null;
        const cx = mapX(j.x, width);
        const cy = mapY(j.y, height);
        return (
          <g key={name}>
            <JointCircle cx={cx} cy={cy} r={jointRadius} />
            {showLabels && (
              <text
                x={cx + 8}
                y={cy + 4}
                fontSize={8}
                fill="#666"
                fontFamily="monospace"
              >
                {name}
              </text>
            )}
          </g>
        );
      }),
    [pose, width, height, jointRadius, showLabels],
  );

  return (
    <svg
      width={width}
      height={height}
      viewBox={`${VIEW_BOX.x} ${VIEW_BOX.y} ${VIEW_BOX.w} ${VIEW_BOX.h}`}
      style={{ maxWidth: "100%", height: "auto" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x={VIEW_BOX.x}
        y={VIEW_BOX.y}
        width={VIEW_BOX.w}
        height={VIEW_BOX.h}
        fill="#f8fafc"
        rx={4}
      />
      {bones}
      {joints}
    </svg>
  );
});

export { StickmanRenderer };
export type { StickmanRendererProps };
