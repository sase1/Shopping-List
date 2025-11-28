import ClientListPage from './ClientListPage';

export default function Page({ params }: { params: { listId: string } }) {
    const { listId } = params;
    return <ClientListPage listId={listId} />;
}
