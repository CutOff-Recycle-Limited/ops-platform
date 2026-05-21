import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const { operation, members, loading: opLoading } = useOperation(id);
  const { tasks, loading: tasksLoading, reload, updateTaskStatus } = useTasks(id);

  const [statuses, setStatuses] = useState([]);
  const [transitions, setTransitions] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [filters, setFilters] = useState({ priority: '', assignee_id: '' });

  const dragTaskId = useRef(null);
  const [dragOverCol, setDragOverCol] = useState(null);

  useEffect(() => {
    if (!id) return;
    opsApi.getWorkflow(id)
      .then(res => { setStatuses(res.statuses || []); setTransitions(res.transitions || []); })
      .catch(console.error);
    authApi.users().then(res => setAllUsers(res.users)).catch(console.error);
  }, [id]);

  useEffect(() => {
    setSelectedTaskId(searchParams.get('task'));
  }, [searchParams]);

  const openTask = useCallback((taskId) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('task', taskId);
    setSearchParams(nextParams);
    setSelectedTaskId(taskId);
  }, [searchParams, setSearchParams]);

  const closeTask = useCallback(() => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('task');
    setSearchParams(nextParams, { replace: true });
    setSelectedTaskId(null);
    reload();
  }, [searchParams, setSearchParams, reload]);

  const tasksByStatus = statuses.reduce((acc, s) => {
    acc[s.id] = tasks.filter(t => {
      if (t.status_id !== s.id) return false;
      if (filters.priority && t.priority !== filters.priority) return false;
      if (filters.assignee_id && t.assignee_id !== filters.assignee_id) return false;
      return true;
    });
    return acc;
  }, {});

  const handleDragStart = useCallback((taskId) => { dragTaskId.current = taskId; }, []);
  const handleDragOver = useCallback((e, statusId) => { e.preventDefault(); setDragOverCol(statusId); }, []);
  const handleDragLeave = useCallback((e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverCol(null); }, []);

  const handleDrop = useCallback(async (e, targetStatusId) => {
    e.preventDefault();
    const taskId = dragTaskId.current;
    dragTaskId.current = null;
    setDragOverCol(null);
    if (!taskId) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status_id === targetStatusId) return;
    updateTaskStatus(taskId, targetStatusId);
    try {
      await tasksApi.transition(taskId, targetStatusId);
    } catch (err) {
      updateTaskStatus(taskId, task.status_id);
      alert(`Cannot move: ${err.message}`);
    }
  }, [tasks, updateTaskStatus]);

  if (opLoading) return (
    <div className="flex-1 flex items-center justify-center bg-[#f4f7f4]">
      <div className="w-6 h-6 border-2 border-[#50ad32] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!operation) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-400 font-semibold mb-3">Operation not found</p>
        <Link to="/operations" className="btn-primary">Back to Operations</Link>
      </div>
    </div>
  );

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter(t => statuses.find(s => s.id === t.status_id)?.category === 'done').length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#f4f7f4]">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-100 bg-white px-6 py-3.5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/operations" className="text-gray-400 hover:text-[#50ad32] transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-xs"
              style={{ backgroundColor: operation.color }}
            >
              {operation.key?.substring(0, 2)}
            </div>
            <div>
              <h1 className="font-black text-[#1a1a1a] text-sm">{operation.name}</h1>
              <p className="text-[11px] text-gray-400 font-semibold">
                {totalTasks} tasks · {doneTasks} done
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Member avatars */}
            <div className="flex items-center -space-x-1.5">
              {members.slice(0, 4).map(m => (
                <Avatar key={m.id} name={m.name} color={m.avatar_color} size="xs" className="ring-1 ring-white" />
              ))}
              {members.length > 4 && (
                <div className="w-5 h-5 rounded-full bg-gray-100 border border-white flex items-center justify-center text-[10px] font-bold text-gray-500">
                  +{members.length - 4}
                </div>
              )}
            </div>

            <select
              className="bg-white border border-gray-200 rounded-lg py-1.5 px-2 text-xs font-bold text-gray-600 focus:outline-none focus:border-[#50ad32] w-28"
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
              className="bg-white border border-gray-200 rounded-lg py-1.5 px-2 text-xs font-bold text-gray-600 focus:outline-none focus:border-[#50ad32] w-32"
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
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: status.color }} />
                    <span className="text-xs font-black text-gray-600 uppercase tracking-wider">
                      {status.name}
                    </span>
                    <span className="text-[11px] font-black text-gray-400 bg-white border border-gray-100 px-1.5 rounded-md shadow-sm">
                      {colTasks.length}
                    </span>
                  </div>
                  <button
                    onClick={() => setShowCreate(true)}
                    className="text-gray-300 hover:text-[#50ad32] transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>

                {/* Column Body */}
                <div
                  className={`flex-1 overflow-y-auto rounded-xl p-2 space-y-2.5 transition-all min-h-24 ${
                    isOver
                      ? 'bg-[#50ad32]/5 border-2 border-dashed border-[#50ad32]/30'
                      : 'bg-black/[0.02] border-2 border-transparent'
                  }`}
                >
                  {tasksLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="w-5 h-5 border-2 border-[#50ad32] border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : colTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center opacity-40">
                      <div className="w-8 h-8 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center mb-2">
                        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                      </div>
                      <p className="text-xs text-gray-400 font-semibold">Drop tasks here</p>
                    </div>
                  ) : (
                    colTasks.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        operationKey={operation.key}
                        onClick={() => openTask(task.id)}
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
        onClose={closeTask}
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
            onClose={closeTask}
            onUpdate={reload}
          />
        )}
      </Modal>

      {/* Create Task Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Task" size="md">
        <CreateTaskModal
          operationId={id}
          onClose={() => setShowCreate(false)}
          onCreated={() => reload()}
        />
      </Modal>
    </div>
  );
}
