"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, { Map } from "maplibre-gl";
import Link from "next/link";

type PickedVillage = {
  id: string; // `${ADMIT_ID}-${ADMIV_ID}`
  district: string; // ADMIT
  village: string; // T_NAME
};

export default function VillageMap() {
  const mapRef = useRef<Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [picked, setPicked] = useState<PickedVillage | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {},
        layers: [
            {
            id: "bg",
            type: "background",
            paint: { "background-color": "#f3f4f6" }, // 灰底，可改色
            },
        ],
      } as any,
      center: [121.48, 25.02], // 新北附近
      zoom: 9.5,
    });

    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), "top-left");

    map.on("load", async () => {
      const res = await fetch("/ntpc_villages.geojson");
      if (!res.ok) throw new Error("Failed to load /ntpc_villages.geojson");
      const geojson = await res.json();

      // Source
      map.addSource("villages", {
        type: "geojson",
        data: geojson,
      });

      /**
       * 區別顏色：依 properties.ADMIT（區名）
       * 你可以自行調色或補齊所有區
       */
      const districtColorExpr: any = [
        "match",
        ["get", "ADMIT"],
        "板橋區",
        "#fdba74",
        "新莊區",
        "#c4b5fd",
        "三重區",
        "#fca5a5",
        "新店區",
        "#93c5fd",
        "淡水區",
        "#86efac",
        "汐止區",
        "#fcd34d",
        "中和區",
        "#a7f3d0",
        "永和區",
        "#fecaca",
        "土城區",
        "#bfdbfe",
        "樹林區",
        "#ddd6fe",
        "三峽區",
        "#bbf7d0",
        "鶯歌區",
        "#fed7aa",
        "蘆洲區",
        "#fbcfe8",
        "五股區",
        "#bae6fd",
        "泰山區",
        "#fde68a",
        "林口區",
        "#99f6e4",
        "八里區",
        "#fecdd3",
        "金山區",
        "#d9f99d",
        "萬里區",
        "#c7d2fe",
        "石門區",
        "#e9d5ff",
        "三芝區",
        "#fef9c3",
        "瑞芳區",
        "#a5b4fc",
        "貢寮區",
        "#a7f3d0",
        "雙溪區",
        "#fdba74",
        "平溪區",
        "#fca5a5",
        "坪林區",
        "#93c5fd",
        "烏來區",
        "#86efac",
        "深坑區",
        "#fcd34d",
        "石碇區",
        "#ddd6fe",
        /* default */ "#c7d2fe",
      ];

      // 1) 色塊
      map.addLayer({
        id: "village-fill",
        type: "fill",
        source: "villages",
        paint: {
          "fill-color": districtColorExpr,
          "fill-opacity": 0.35,
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
            0.2,
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
          "line-opacity": 0.8,
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

      // 點擊：維持你原本的小卡
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
        setPicked({ id, district, village });
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

      {picked && (
        <div className="absolute right-4 top-4 w-[340px] rounded-2xl bg-white/95 p-4 shadow-lg text-gray-900">
          <div className="text-lg font-semibold text-gray-900">
            {picked.district}｜{picked.village}
          </div>

          <div className="mt-1 text-sm text-gray-900">Key：{picked.id}</div>

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
