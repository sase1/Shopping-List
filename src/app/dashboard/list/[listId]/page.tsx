// src/app/dashboard/list/[listId]/page.tsx
import ClientListPage from './ClientListPage';

export default function Page({ params }: { params: Record<string, string> }) {
    // TS infers params properly; Vercel won’t complain
    return <ClientListPage listId={params.listId} />;
}
