import ClientPage from './_client';

export async function generateStaticParams() {
  return [];
}

export default function Page() {
  return <ClientPage />;
}
