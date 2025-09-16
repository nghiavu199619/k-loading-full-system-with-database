import CardHandsontable from "@/components/card-handsontable";

export default function CardManagement() {
  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ marginLeft: "0rem" }}>
      <div className="h-full p-2">
        <CardHandsontable />
      </div>
    </div>
  );
}