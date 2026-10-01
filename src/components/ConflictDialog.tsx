import type { ConflictResolution, ResolutionOption } from '../types';

interface Props {
  resolution: ConflictResolution;
  onChoose: (option: ResolutionOption) => void;
  onReject: () => void;
}

const KIND_TEXT: Record<ConflictResolution['kind'], string> = {
  covers_existing: 'covers all of',
  existing_head: 'overlaps the start of',
  existing_tail: 'overlaps the end of',
  inside_existing: 'falls inside',
};

export function ConflictDialog({ resolution, onChoose, onReject }: Props) {
  return (
    <div className="modal-overlay">
      <div className="modal conflict-modal">
        <h2 className="modal-title">Schedule Conflict</h2>

        <p className="conflict-summary">
          <strong>{resolution.newTitle}</strong> ({resolution.newRange.start} –{' '}
          {resolution.newRange.end}) {KIND_TEXT[resolution.kind]}{' '}
          <strong>{resolution.existingTitle}</strong> ({resolution.existingRange.start} –{' '}
          {resolution.existingRange.end})
          {resolution.isRecurring && ' — recurring'}
        </p>

        <p className="conflict-question">How should this be resolved?</p>

        <div className="conflict-options">
          {resolution.options
            .filter((o) => o.kind !== 'cancel')
            .map((option, i) => (
              <button
                key={i}
                className="conflict-option"
                onClick={() => onChoose(option)}
              >
                <span className="conflict-option-label">{option.label}</span>
                <span className="conflict-option-detail">{option.detail}</span>
              </button>
            ))}
        </div>

        <div className="form-actions">
          <div className="form-actions-right">
            <button className="btn btn-ghost" onClick={onReject}>
              Cancel — don't add "{resolution.newTitle}"
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
