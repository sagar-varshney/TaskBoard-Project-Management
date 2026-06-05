import TicketDetail from "../../components/TicketDetail";

export default async function TicketPage({ params }) {
  const { id } = await params;

  return <TicketDetail ticketId={id} />;
}
