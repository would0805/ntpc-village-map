"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, { Map } from "maplibre-gl";
import Link from "next/link";
import * as turf from "@turf/turf";

type PickedVillage = {
  id: string; // `${ADMIT_ID}-${ADMIV_ID}`
  district: string; // ADMIT
  village: string; // T_NAME
  zone: "一區" | "二區" | "三區";
};

const zone1 = ["板橋區", "三重區", "蘆洲區", "中和區", "永和區", "新莊區"];
const zone2 = ["新店區", "淡水區", "汐止區", "土城區", "樹林區", "林口區", "三峽區", "鶯歌區", "五股區", "泰山區"];

function getZone(district: string): PickedVillage["zone"] {
  if (zone1.includes(district)) return "一區";
  if (zone2.includes(district)) return "二區";
  return "三區";
}

// 你指定的新顏色
const ZONE1_COLOR = "#28c8c8"; // 一區
const ZONE2_COLOR = "#fde68a"; // 二區（淺黃色）
const ZONE3_COLOR = "#e5e7eb"; // 三區（淺灰色）

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
      const villagesGeo = await res.json();

      map.addSource("villages", {
        type: "geojson",
        data: villagesGeo,
        generateId: false,
      });

      // districts：flatten -> dissolve(ADMIT)
      const flattened = turf.flatten(villagesGeo as any) as any;

      let dissolved: any;
      try {
        dissolved = turf.dissolve(flattened, { propertyName: "ADMIT" } as any);
      } catch {
        dissolved = turf.dissolve(flattened, { property: "ADMIT" } as any);
      }

      dissolved.features = (dissolved.features ?? []).map((f: any) => {
        const admit = String(f?.properties?.ADMIT ?? "");
        return {
          ...f,
          properties: {
            ...(f.properties ?? {}),
            ZONE: getZone(admit),
          },
        };
      });

      map.addSource("districts", {
        type: "geojson",
        data: dissolved,
      });

      // 里色塊（依一區/二區/三區）
      map.addLayer({
        id: "village-fill",
        type: "fill",
        source: "villages",
        paint: {
          "fill-color": [
            "case",
            ["in", ["get", "ADMIT"], ["literal", zone1]],
            ZONE1_COLOR,
            ["in", ["get", "ADMIT"], ["literal", zone2]],
            ZONE2_COLOR,
            ZONE3_COLOR,
          ],
          "fill-opacity": 0.65,
        },
      });

      // Hover 高亮
      map.addLayer({
        id: "village-hover",
        type: "fill",
        source: "villages",
        paint: {
          "fill-color": "#111827",
          "fill-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.18, 0],
        },
      });

      // hit layer
      map.addLayer({
        id: "village-fill-hit",
        type: "fill",
        source: "villages",
        paint: { "fill-color": "#000000", "fill-opacity": 0.001 },
      });

      // 里界線（細）
      map.addLayer({
        id: "village-boundary",
        type: "line",
        source: "villages",
        paint: {
          "line-width": 1,
          "line-color": "#111827",
          "line-opacity": 0.35,
        },
      });

      // 區外框（粗黑）
      map.addLayer({
        id: "district-outline",
        type: "line",
        source: "districts",
        paint: {
          "line-color": "#000000",
          "line-width": 3,
          "line-opacity": 0.9,
        },
      });

      // ✅ 區名標籤：板橋區不顯示「一區」，其他區顯示「區名 + (一區/二區/三區)」
      map.addLayer({
        id: "district-label",
        type: "symbol",
        source: "districts",
        layout: {
          "symbol-placement": "point",
          "text-field": ["get", "ADMIT"],
          // 字更大
          "text-size": ["interpolate", ["linear"], ["zoom"], 9, 16, 11, 20, 13, 24],
          "text-allow-overlap": false,
          "text-ignore-placement": false,
          "text-padding": 2,
        },
        paint: {
          "text-color": "#111111",
          "text-halo-color": "rgba(255,255,255,0.85)",
          "text-halo-width": 7,
          "text-halo-blur": 1,
        },
        minzoom: 9.2,
      });

      // 里名標籤
      map.addLayer({
        id: "village-label",
        type: "symbol",
        source: "villages",
        layout: {
          "text-field": ["coalesce", ["get", "T_NAME"], ["get", "ADMIV"]],
          "text-size": ["interpolate", ["linear"], ["zoom"], 11, 10, 13, 12, 15, 14],
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

      // Hover state（id 不可為 null）
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
        const zone = getZone(district);
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
      <div className="absolute left-15 top-4 rounded-2xl bg-white/95 p-3 shadow text-sm text-gray-900">
        <div className="font-semibold">分區圖例</div>
        <div className="mt-2 flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: ZONE1_COLOR }} />
          <span>一區</span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: ZONE2_COLOR }} />
          <span>二區</span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: ZONE3_COLOR }} />
          <span>三區</span>
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

            <button onClick={() => setPicked(null)} className="rounded-xl border px-3 py-2 text-sm">
              關閉
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
