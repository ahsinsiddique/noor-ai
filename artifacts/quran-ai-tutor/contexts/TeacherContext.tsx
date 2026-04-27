import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { type Teacher, defaultTeacher, getTeacherById } from "@/data/teachers";

interface TeacherContextValue {
  teacher: Teacher;
  setTeacher: (id: string) => void;
}

const STORAGE_KEY = "@quran_tutor_teacher";

const TeacherContext = createContext<TeacherContextValue>({
  teacher: defaultTeacher,
  setTeacher: () => {},
});

export function TeacherProvider({ children }: { children: React.ReactNode }) {
  const [teacher, setTeacherState] = useState<Teacher>(defaultTeacher);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((id) => { if (id) setTeacherState(getTeacherById(id)); })
      .catch(() => {});
  }, []);

  const setTeacher = useCallback((id: string) => {
    const t = getTeacherById(id);
    setTeacherState(t);
    AsyncStorage.setItem(STORAGE_KEY, id).catch(() => {});
  }, []);

  return (
    <TeacherContext.Provider value={{ teacher, setTeacher }}>
      {children}
    </TeacherContext.Provider>
  );
}

export function useTeacher() {
  return useContext(TeacherContext);
}
