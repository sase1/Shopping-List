import ClientListPage from './ClientListPage';

export default async function Page({ params }: { params: Record<string, string> }) {
    // Do NOT define a separate interface for params
    return <ClientListPage listId={params.listId} />;
}
