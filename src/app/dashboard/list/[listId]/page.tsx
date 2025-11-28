import ClientListPage from './ClientListPage';

export default function Page(props: { params: { listId: string } }) {
    const listId = props.params.listId;
    return <ClientListPage listId={listId} />;
}
