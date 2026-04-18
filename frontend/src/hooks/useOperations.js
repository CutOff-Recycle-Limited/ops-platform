import { useState, useEffect, useCallback } from 'react';
import { operations as opsApi } from '../services/api';

export function useOperations() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await opsApi.list();
      setData(res.operations);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { operations: data, loading, error, reload: load };
}

export function useOperation(id) {
  const [operation, setOperation] = useState(null);
  const [members, setMembers] = useState([]);
  const [workflow, setWorkflow] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await opsApi.get(id);
      setOperation(res.operation);
      setMembers(res.members);
      setWorkflow(res.workflow);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  return { operation, members, workflow, loading, reload: load };
}
