import ClientListPage from './ClientListPage';

interface ListPageParams {
    listId: string;
}

interface ListPageProps {
    params: ListPageParams;
}

export default function ListPage({ params }: ListPageProps) {
    const { listId } = params;

    // Just render the client component and pass the typed prop
    return <ClientListPage listId={listId} />;
}
