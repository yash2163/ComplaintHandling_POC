import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-50">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex">
        <h1 className="text-4xl font-bold mb-8 text-indigo-800">INDIGO AIRLINES</h1>
      </div>

      <div className="grid text-center lg:max-w-5xl lg:w-full lg:mb-0 lg:grid-cols-3 lg:text-left gap-8">
        <Link
          href="/cx"
          className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-indigo-300 hover:bg-white hover:shadow-lg"
        >
          <h2 className="mb-3 text-2xl font-semibold text-indigo-600">
            CX Team View{' '}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              -&gt;
            </span>
          </h2>
          <p className="m-0 max-w-[30ch] text-gray-500 text-sm">
            Read-only view of customer complaints and AI extraction status.
            Simulates the Outlook experience.
          </p>
        </Link>

        <Link
          href="/cr-team"
          className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-indigo-300 hover:bg-white hover:shadow-lg"
        >
          <h2 className="mb-3 text-2xl font-semibold text-green-600">
            CR Team View{' '}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              -&gt;
            </span>
          </h2>
          <p className="m-0 max-w-[30ch] text-gray-500 text-sm">
            Review Base Ops resolutions, monitor confidence scores, and oversee customer responses.
          </p>
        </Link>

        <Link
          href="/base-ops"
          className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-indigo-300 hover:bg-white hover:shadow-lg"
        >
          <h2 className="mb-3 text-2xl font-semibold text-rose-600">
            Base Ops View{' '}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              -&gt;
            </span>
          </h2>
          <p className="m-0 max-w-[30ch] text-gray-500 text-sm">
            Operational dashboard to review complaints, coordinate with crew, and approve responses.
          </p>
        </Link>
      </div>
    </main>
  );
}
