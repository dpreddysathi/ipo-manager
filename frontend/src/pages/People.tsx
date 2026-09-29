import { useEffect, useState } from 'react';
import { api } from '../api';
import { useDrawer } from '../drawer';
import type { Person, Transaction } from '../types';
import { initials } from '../utils';
import { PersonModal } from '../components/Modals';

export function People() {
  const [people, setPeople] = useState<Person[]>([]);
  const [pending, setPending] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editPerson, setEditPerson] = useState<Person | null>(null);
  const { openDrawer } = useDrawer();

  const load = () => {
    setLoading(true);
    Promise.all([api.listPeople(), api.listTransactions({ pendingOnly: true })])
      .then(([p, t]) => {
        setPeople(p);
        setPending(t);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : 'Failed to load people.'),
      )
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const pendingFor = (personId: number) =>
    pending.filter((t) => t.personId === personId);

  const deletePerson = async (p: Person) => {
    if (
      !window.confirm(
        `Delete "${p.name}" and all their transactions & applications?`,
      )
    )
      return;
    try {
      await api.deletePerson(p.id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed.');
    }
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>People</h1>
          <p className="sub">
            Click anyone to open their full report across all IPOs.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          + Add Person
        </button>
      </div>

      {loading && <div className="loading">Loading…</div>}
      {error && <div className="error-box">{error}</div>}

      {!loading && !error && (
        <div className="list-grid">
          {people.map((p) => {
            const pend = pendingFor(p.id);
            return (
              <div
                key={p.id}
                className="card ipo-card"
                onClick={() => openDrawer({ personId: p.id })}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') openDrawer({ personId: p.id });
                }}
              >
                <div className="card-top">
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div className="avatar" style={{ width: 44, height: 44 }}>
                      {initials(p.name)}
                    </div>
                    <div>
                      <h3 style={{ margin: 0 }}>{p.name}</h3>
                      <div className="meta" style={{ marginTop: 2 }}>
                        {p.phone || 'No phone'}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      title={`Edit ${p.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditPerson(p);
                      }}
                    >
                      ✏️
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      title={`Delete ${p.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        deletePerson(p);
                      }}
                    >
                      🗑
                    </button>
                  </div>
                </div>
                {pend.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <span className="pill pill-amber">
                      {pend.length} pending settlement
                      {pend.length !== 1 && 's'}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
          {people.length === 0 && (
            <div className="card empty">
              No people yet. Click <strong>+ Add Person</strong> to add someone.
            </div>
          )}
        </div>
      )}

      {showAdd && (
        <PersonModal
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false);
            load();
          }}
        />
      )}

      {editPerson && (
        <PersonModal
          initial={editPerson}
          onClose={() => setEditPerson(null)}
          onSaved={() => {
            setEditPerson(null);
            load();
          }}
        />
      )}
    </div>
  );
}
