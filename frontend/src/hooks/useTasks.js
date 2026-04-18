import { useState, useEffect, useCallback } from 'react';
import { tasks as tasksApi } from '../services/api';

export function useTasks(operationId, filters = {}) {
  const [taskList, setTaskList] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!operationId) return;
    try {
      setLoading(true);
      const res = await tasksApi.list(operationId, filters);
      setTaskList(res.tasks);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [operationId]);

  useEffect(() => { load(); }, [load]);

  // Optimistic status update for Kanban drag
  const updateTaskStatus = useCallback((taskId, newStatusId) => {
    setTaskList(prev =>
      prev.map(t => t.id === taskId ? { ...t, status_id: newStatusId } : t)
    );
  }, []);

  return { tasks: taskList, loading, reload: load, updateTaskStatus, setTaskList };
}

export function useTask(id) {
  const [task, setTask] = useState(null);
  const [subtasks, setSubtasks] = useState([]);
  const [commentList, setCommentList] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await tasksApi.get(id);
      setTask(res.task);
      setSubtasks(res.subtasks);
      setCommentList(res.comments);
      setActivity(res.activity);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  return { task, subtasks, comments: commentList, activity, loading, reload: load, setTask, setCommentList };
}
