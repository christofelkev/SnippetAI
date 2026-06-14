export default function Toast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-6 right-6 bg-zinc-800 text-zinc-100 px-4 py-2 rounded-lg shadow-lg border border-zinc-700 animate-[bounce_0.3s_ease-out]">
      {message}
    </div>
  );
}
