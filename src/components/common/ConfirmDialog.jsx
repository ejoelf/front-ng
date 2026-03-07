import Modal from "./Modal";
import Button from "./Button";
import "./ConfirmDialog.css";

export default function ConfirmDialog({
  open,
  title = "Confirmar",
  message = "¿Seguro?",
  confirmText = "Confirmar",
  cancelText = "Volver",
  danger = false,
  onConfirm,
  onClose,
}) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <div className="confirmBox">
        <div className="confirmMsg">{message}</div>

        <div className="confirmActions">
          <Button type="button" onClick={onClose}>
            {cancelText}
          </Button>
          <Button variant={danger ? "danger" : "primary"} type="button" onClick={onConfirm}>
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
