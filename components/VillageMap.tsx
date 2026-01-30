"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, { Map } from "maplibre-gl";
import Link from "next/link";

type PickedVillage = {
  id: string; // `${ADMIT_ID}-${ADMIV_ID}`
  district: string; // ADMIT
  village: string; // T_NAME
  zone: "一區" | "二區" | "三區";
};

const yolk = ["板橋區", "三重區", "蘆洲區", "中和區", "永和區", "新莊區"];
const white = ["新店區", "淡水區", "汐止區", "土城區", "樹林區", "林口區", "三峽區", "鶯歌區", "五股區", "泰山區"];

export default function VillageMap() {
  const mapRef = useRef<Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [picked, setPicked] = useState<PickedVillage | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      // 純色背景：不顯示底圖台灣圖樣
      style: {
        version: 8,
        sources: {},
        layers: [
          {
            id: "bg",
            type: "background",
            paint: { "background-color": "#f3f4f6" },
          },
        ],
      } as any,
      center: [121.48, 25.02],
      zoom: 9.5,
    });

    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), "top-left");

    map.on("load", async () => {
      const res = await fetch("/ntpc_villages.geojson");
      if (!res.ok) throw new Error("Failed to load /ntpc_villages.geojson");
      const geojson = await res.json();

      map.addSource("villages", {
        type: "geojson",
        data: geojson,
      });

      // 1) 策略色塊（依區分類：蛋黃/蛋白/蛋殼）
      map.addLayer({
        id: "village-fill",
        type: "fill",
        source: "villages",
        paint: {
          "fill-color": [
            "case",
            ["in", ["get", "ADMIT"], ["literal", yolk]],
            "#28c8c8", // 蛋黃：紅
            ["in", ["get", "ADMIT"], ["literal", white]],
            "#ffffce", // 蛋白：藍
            "#9ca3af", // 蛋殼：灰
          ],
          "fill-opacity": 0.55,
        },
      });

      // 2) Hover 高亮（feature-state）
      map.addLayer({
        id: "village-hover",
        type: "fill",
        source: "villages",
        paint: {
          "fill-color": "#111827",
          "fill-opacity": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            0.22,
            0,
          ],
        },
      });

      // 3) 透明 hit layer（方便點擊）
      map.addLayer({
        id: "village-fill-hit",
        type: "fill",
        source: "villages",
        paint: {
          "fill-color": "#000000",
          "fill-opacity": 0.001,
        },
      });

      // 4) 里界線
      map.addLayer({
        id: "village-boundary",
        type: "line",
        source: "villages",
        paint: {
          "line-width": 1,
          "line-color": "#111827",
          "line-opacity": 0.7,
        },
      });

      // 5) 里名標籤（縮放後才顯示，避免擠在一起）
      map.addLayer({
        id: "village-label",
        type: "symbol",
        source: "villages",
        layout: {
          "text-field": ["coalesce", ["get", "T_NAME"], ["get", "ADMIV"]],
          "text-size": ["interpolate", ["linear"], ["zoom"], 10, 10, 12, 12, 14, 14],
          "text-allow-overlap": false,
          "text-ignore-placement": false,
        },
        paint: {
          "text-color": "#111111",
          "text-halo-color": "#ffffff",
          "text-halo-width": 2,
          "text-halo-blur": 0.5,
        },
        minzoom: 11,
      });

      // Hover 狀態管理：id 不能是 null
      let hoveredId: string | number | undefined = undefined;

      map.on("mouseenter", "village-fill-hit", () => {
        map.getCanvas().style.cursor = "pointer";
      });

      map.on("mouseleave", "village-fill-hit", () => {
        map.getCanvas().style.cursor = "";
        if (hoveredId !== undefined) {
          map.setFeatureState({ source: "villages", id: hoveredId }, { hover: false });
        }
        hoveredId = undefined;
      });

      map.on("mousemove", "village-fill-hit", (e) => {
        const f = e.features?.[0] as any;
        if (!f) return;

        const p = f.properties as any;
        const admitId = String(p?.ADMIT_ID ?? "");
        const admivId = String(p?.ADMIV_ID ?? "");
        const fid = admitId && admivId ? `${admitId}-${admivId}` : undefined;
        if (!fid) return;

        if (hoveredId !== undefined && hoveredId !== fid) {
          map.setFeatureState({ source: "villages", id: hoveredId }, { hover: false });
        }
        hoveredId = fid;
        map.setFeatureState({ source: "villages", id: hoveredId }, { hover: true });
      });

      // 點擊：顯示小卡（含蛋黃/蛋白/蛋殼）
      map.on("click", "village-fill-hit", (e) => {
        const f = e.features?.[0];
        if (!f) return;

        const p = f.properties as any;

        const district = String(p.ADMIT ?? "");
        const village = String(p.T_NAME ?? p.ADMIV ?? "");
        const admitId = String(p.ADMIT_ID ?? "");
        const admivId = String(p.ADMIV_ID ?? "");

        if (!district || !village || !admitId || !admivId) return;

        const id = `${admitId}-${admivId}`;
        const zone: PickedVillage["zone"] = yolk.includes(district)
          ? "一區"
          : white.includes(district)
          ? "二區"
          : "三區";

        setPicked({ id, district, village, zone });
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      {/* Legend */}
      <div className="absolute left-10 top-4 rounded-2xl bg-white/95 p-3 shadow text-sm text-gray-900">
        <div className="font-semibold">分區圖例</div>
        <div className="mt-2 flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: "#28c8c8" }} />
          <span>蛋黃：板橋/三蘆/中永和/新莊</span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: "#ffffce" }} />
          <span>蛋白：新店/淡水/汐止/土城/樹林/林口/三峽/鶯歌/五股/泰山</span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: "#9ca3af" }} />
          <span>蛋殼：其他</span>
        </div>
      </div>

      {/* Picked card */}
      {picked && (
        <div className="absolute right-4 top-4 w-[360px] rounded-2xl bg-white/95 p-4 shadow-lg text-gray-900">
          <div className="text-lg font-semibold text-gray-900">
            {picked.district}｜{picked.village}
          </div>

          <div className="mt-1 text-sm text-gray-900">Key：{picked.id}</div>
          <div className="mt-1 text-sm text-gray-900">分區：{picked.zone}</div>

          <div className="mt-4 flex gap-2">
            <Link
              href={`/village/${encodeURIComponent(picked.id)}`}
              className="rounded-xl bg-black px-3 py-2 text-sm text-white"
            >
              查看詳細
            </Link>

            <button
              onClick={() => setPicked(null)}
              className="rounded-xl border px-3 py-2 text-sm"
            >
              關閉
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
