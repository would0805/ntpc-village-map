type Props = { params: { id: string } };

export default function VillageDetailPage({ params }: Props) {
  const id = decodeURIComponent(params.id);

  return (
    <main className="min-h-screen p-6">
      <div className="text-2xl font-semibold">里詳細頁</div>
      <div className="mt-2 text-gray-700">Key：{id}</div>

      <div className="mt-6 rounded-2xl border p-4">
        <div className="font-medium">負責人</div>
        <div className="mt-1 text-gray-600">（下一步再串資料）</div>
      </div>
    </main>
  );
}
