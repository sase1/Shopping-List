import ClientListPage from './ClientListPage';

export default function Page(props: any) {
    // Next.js passes params internally, we just forward them
    return <ClientListPage listId={props.params.listId} />;
}
