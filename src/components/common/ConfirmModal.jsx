import Modal from './Modal'
import { FiAlertTriangle } from 'react-icons/fi'

export default function ConfirmModal({ open, onClose, onConfirm, title, message }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title || 'تایید عملیات'}
      size="sm"
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose}>انصراف</button>
          <button className="btn btn-danger" onClick={() => { onConfirm(); onClose() }}>تایید و حذف</button>
        </>
      }
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <FiAlertTriangle style={{ fontSize: 26, color: 'var(--danger)', flexShrink: 0 }} />
        <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 13.5 }}>
          {message || 'آیا از انجام این عملیات اطمینان دارید؟ این عملیات غیرقابل بازگشت است.'}
        </p>
      </div>
    </Modal>
  )
}
