import PersonDetailPage from "../../../components/PersonDetailPage";

export default async function PersonDetailRoute({ params }) {
  const resolvedParams = await params;
  return <PersonDetailPage personId={resolvedParams.id} />;
}
