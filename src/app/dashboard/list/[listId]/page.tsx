import ClientListPage from './ClientListPage';

export default function Page({ params }: any) {
    return <ClientListPage listId={params.listId} />;
}
