import GroupDetailPage from "../../../components/GroupDetailPage";

export default async function GroupDetailRoute({ params }) {
  const resolvedParams = await params;
  return <GroupDetailPage groupId={resolvedParams.groupId} />;
}
