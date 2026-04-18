import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useOperation } from '../hooks/useOperations.js';
import { useTasks } from '../hooks/useTasks.js';
import { operations as opsApi, tasks as tasksApi, auth as authApi } from '../services/api';
import TaskCard from '../components/TaskCard.jsx';
import TaskModal from '../components/TaskModal.jsx';
import CreateTaskModal from '../components/CreateTaskModal.jsx';
import Modal from '../components/Modal.jsx';
import Avatar from '../components/Avatar.jsx';

export default function KanbanPage() {
  const { id } = useParams();
  const { operation, members, loading: opLoading } = useOperation(id);
  const { tasks, loading: tasksLoading, reload, updateTaskStatus } = useTasks(id);

  const [statuses, setStatuses] = useState([]);
  const [transitions, setTransitions] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [filters, setFilters] = useState({ priority: '', assignee_id: '' });

  // Drag state
  const dragTaskId = useRef(null);
  const [dragOverCol, setDragOverCol] = useState(null);

  useEffect(() => {
    if (!id) return;
    opsApi.getWorkflow(id)
      .then(res => {
        setStatuses(res.statuses || []);
        setTransitions(res.transitions || []);
      })
      .catch(console.error);

    authApi.users()
      .then(res => setAllUsers(res.users))
      .catch(console.error);
  }, [id]);

  // Group tasks by status
  const tasksByStatus = statuses.reduce((acc, s) => {
    acc[s.id] = tasks.filter(t => {
      if (t.status_id !== s.id) return false;
      if (filters.priority && t.priority !== filters.priority) return false;
      if (filters.assignee_id && t.assignee_id !== filters.assignee_id) return false;
      return true;
    });
    return acc;
  }, {});

  // Drag handlers
  const handleDragStart = useCallback((taskId) => {
    dragTaskId.current = taskId;
  }, []);

  const handleDragOver = useCallback((e, statusId) => {
    e.preventDefault();
    setDragOverCol(statusId);
  }, []);

  const handleDrop = useCallback(async (e, targetStatusId) => {
    e.preventDefault();
    const taskId = dragTaskId.current;
    dragTaskId.current = null;
    setDragOverCol(null);

    if (!taskId) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status_id === targetStatusId) return;

    // Optimistic update
    updateTaskStatus(taskId, targetStatusId);

    try {
      await tasksApi.transition(taskId, targetStatusId);
    } catch (err) {
      // Revert on failure
      updateTaskStatus(taskId, task.status_id);
      alert(`Cannot move: ${err.message}`);
    }
  }, [tasks, updateTaskStatus]);

  const handleDragLeave = useCallback((e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverCol(null);
    }
  }, []);

  if (opLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!operation) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 mb-3">Operation not found</p>
          <Link to="/operations" className="btn-primary">Back to Operations</Link>
        </div>
      </div>
    );
  }

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter(t => {
    const status = statuses.find(s => s.id === t.status_id);
    return status?.category === 'done';
  }).length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-surface-border bg-surface px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/operations" className="text-slate-500 hover:text-slate-300 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
              style={{ backgroundColor: operation.color + '25', color: operation.color, border: `1.5px solid ${operation.color}40` }}
            >
              {operation.key?.substring(0, 2)}
            </div>
            <div>
              <h1 className="font-semibold text-white text-sm">{operation.name}</h1>
              <p className="text-[11px] text-slate-500">
                {totalTasks} tasks · {doneTasks} done
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Member avatars */}
            <div className="flex items-center -space-x-1.5">
              {members.slice(0, 4).map(m => (
                <Avatar key={m.id} name={m.name} color={m.avatar_color} size="xs" className="ring-1 ring-surface" />
              ))}
              {members.length > 4 && (
                <div className="w-5 h-5 rounded-full bg-surface-2 border border-surface-border flex items-center justify-center text-[10px] text-slate-400">
                  +{members.length - 4}
                </div>
              )}
            </div>

            {/* Filters */}
            <select
              className="input py-1.5 text-xs w-28"
              value={filters.priority}
              onChange={e => setFilters(f => ({ ...f, priority: e.target.value }))}
            >
              <option value="">All Priority</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <select
              className="input py-1.5 text-xs w-32"
              value={filters.assignee_id}
              onChange={e => setFilters(f => ({ ...f, assignee_id: e.target.value }))}
            >
              <option value="">All Members</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>

            <button
              onClick={() => setShowCreate(true)}
              className="btn-primary flex items-center gap-1.5 py-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Task
            </button>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full gap-4 p-5 min-w-max">
          {statuses.map(status => {
            const colTasks = tasksByStatus[status.id] || [];
            const isOver = dragOverCol === status.id;

            return (
              <div
                key={status.id}
                className="w-72 flex flex-col flex-shrink-0"
                onDragOver={e => handleDragOver(e, status.id)}
                onDrop={e => handleDrop(e, status.id)}
                onDragLeave={handleDragLeave}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: status.color }}
                    />
                    <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
                      {status.name}
                    </span>
                    <span className="text-[11px] font-mono text-slate-600 bg-surface-2 px-1.5 rounded-md">
                      {colTasks.length}
                    </span>
                  </div>
                  <button
                    onClick={() => setShowCreate(true)}
                    className="text-slate-600 hover:text-slate-300 transition-colors p-0.5 rounded"
                    title="Add task"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>

                {/* Column Body */}
                <div
                  className={`flex-1 overflow-y-auto rounded-xl p-2 space-y-2.5 transition-colors min-h-24 ${
                    isOver
                      ? 'bg-accent/5 border border-dashed border-accent/30'
                      : 'bg-surface-1/30 border border-transparent'
                  }`}
                >
                  {tasksLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : colTasks.length === 0 ? (
                    <div className={`flex flex-col items-center justify-center py-8 text-center ${isOver ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                      <div className="w-8 h-8 rounded-full border border-dashed border-slate-700 flex items-center justify-center mb-2">
                        <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                      </div>
                      <p className="text-xs text-slate-600">Drop tasks here</p>
                    </div>
                  ) : (
                    colTasks.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        operationKey={operation.key}
                        onClick={() => setSelectedTaskId(task.id)}
                        onDragStart={() => handleDragStart(task.id)}
                        onDragEnd={() => { dragTaskId.current = null; setDragOverCol(null); }}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Task Detail Modal */}
      <Modal
        open={!!selectedTaskId}
        onClose={() => { setSelectedTaskId(null); reload(); }}
        size="full"
        noPadding
      >
        {selectedTaskId && (
          <TaskModal
            taskId={selectedTaskId}
            operationKey={operation?.key}
            statuses={statuses}
            transitions={transitions}
            users={allUsers}
            onClose={() => { setSelectedTaskId(null); reload(); }}
            onUpdate={reload}
          />
        )}
      </Modal>

      {/* Create Task Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Task" size="md">
        <CreateTaskModal
          operationId={id}
          onClose={() => setShowCreate(false)}
          onCreated={() => { reload(); }}
        />
      </Modal>
    </div>
  );
}
