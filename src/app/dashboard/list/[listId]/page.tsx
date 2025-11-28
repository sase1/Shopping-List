import ClientListPage from './ClientListPage';

export default function Page({ params }: { params: { listId: string } }) {
    return <ClientListPage listId={params.listId} />;
}
