"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, { Map } from "maplibre-gl";
import Link from "next/link";

type PickedVillage = {
  id: string;        // `${ADMIT_ID}-${ADMIV_ID}`
  district: string;  // ADMIT
  village: string;   // T_NAME
};

export default function VillageMap() {
  const mapRef = useRef<Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [picked, setPicked] = useState<PickedVillage | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://demotiles.maplibre.org/style.json",
      center: [121.48, 25.02], // 新北附近
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

      // 透明 fill：作為可點擊面積（不然只點線會很難點）
      map.addLayer({
        id: "village-fill-hit",
        type: "fill",
        source: "villages",
        paint: {
          "fill-color": "#000000",
          "fill-opacity": 0.001,
        },
      });

      // 里界線
      map.addLayer({
        id: "village-boundary",
        type: "line",
        source: "villages",
        paint: {
          "line-width": 1,
        },
      });

      map.on("mouseenter", "village-fill-hit", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "village-fill-hit", () => {
        map.getCanvas().style.cursor = "";
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

        // 全市唯一 key（避免不同區有相同 ADMIV_ID）
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
        <div className="absolute right-4 top-4 w-[340px] rounded-2xl bg-white/95 p-4 shadow-lg">
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
