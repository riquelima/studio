
'use client';

import { useState, useEffect, useMemo, type FC, type DragEvent, useRef, useCallback } from 'react';
import { GripVertical, Plus, MoreHorizontal, Trash2, RefreshCw, Pencil, Settings, LogOut, Lightbulb } from 'lucide-react';
import { useRouter } from 'next/navigation';
 
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { suggestSubtasks } from '@/ai/flows/suggest-subtasks';


// --- TYPES ---
type ColumnId = 'todo' | 'in-progress' | 'done';

type Subtask = {
  id: string;
  text: string;
  completed: boolean;
  task_id: string;
};

type Task = {
  id: string;
  title: string;
  column_id: ColumnId;
  subtasks: Subtask[];
};

type Column = {
  id: ColumnId;
  title: string;
};

const initialColumns: Column[] = [
  { id: 'todo', title: '📋 A fazer' },
  { id: 'in-progress', title: '🚧 Em Progresso' },
  { id: 'done', title: '✅ Concluído' },
];

// --- SUB-COMPONENTS ---

const AppHeader: FC<{ onAddTask: (title: string) => Promise<void>; onRefresh: () => void; isSyncing: boolean }> = ({ onAddTask, onRefresh, isSyncing }) => {
    const router = useRouter();
    const [user, setUser] = useState<{username: string} | null>(null);

    useEffect(() => {
        const storedUser = sessionStorage.getItem('user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
    }, []);

    const handleLogout = () => {
        sessionStorage.removeItem('user');
        router.push('/login');
    };
    
    const handleManageUsers = () => {
        router.push('/admin/users');
    }

    return (
        <header className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-3">
                <img src="https://cdn-icons-png.flaticon.com/512/3475/3475845.png" alt="Ícone de Tarefas" className="w-8 h-8 transition-transform duration-500 ease-in-out hover:rotate-[20deg]" />
                <h1 className="text-2xl font-bold text-foreground">Banco de Tarefas</h1>
            </div>
            <div className="flex items-center gap-2">
                <Button onClick={onRefresh} variant="outline" size="icon" disabled={isSyncing}>
                    <RefreshCw className={cn('h-4 w-4', { 'animate-spin': isSyncing })} />
                </Button>
                <CreateTaskDialog onAddTask={onAddTask} />
                {user?.username === 'admin' && (
                    <Button variant="outline" size="icon" onClick={handleManageUsers}>
                        <Settings className="h-4 w-4" />
                    </Button>
                )}
                 <Button onClick={handleLogout} variant="outline" size="icon">
                    <LogOut className="h-4 w-4" />
                </Button>
            </div>
        </header>
    );
};

const CreateTaskDialog: FC<{ onAddTask: (title: string) => Promise<void> }> = ({ onAddTask }) => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (title.trim() && !loading) {
      setLoading(true);
      await onAddTask(title.trim());
      setTitle('');
      setLoading(false);
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nova Tarefa
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Criar Nova Tarefa</DialogTitle>
          <DialogDescription>
            Digite um título para sua nova tarefa. Você poderá adicionar subtarefas depois.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="title" className="text-right">
              Título
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="col-span-3"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              disabled={loading}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Criando...' : 'Criar Tarefa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};


const SubtaskItem: FC<{
    subtask: Subtask;
    onToggle: () => void;
    onDelete: () => void;
    onUpdateText: (newText: string) => void;
}> = ({ subtask, onToggle, onDelete, onUpdateText }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [text, setText] = useState(subtask.text);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [isEditing]);
    
    const handleUpdate = () => {
        if(text.trim() && text.trim() !== subtask.text) {
            onUpdateText(text.trim());
        }
        setIsEditing(false);
    }

    const handleCheckboxClick = (e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent the click from bubbling up to the div
      onToggle();
    };

    return (
        <div className="flex items-center justify-between p-2 rounded-md hover:bg-white/5 transition-colors group">
            <div className="flex items-center gap-3 flex-grow">
                <Checkbox 
                  id={`subtask-checkbox-${subtask.id}`} 
                  checked={subtask.completed} 
                  onClick={handleCheckboxClick} 
                  aria-label={`Marcar subtarefa ${subtask.text} como ${subtask.completed ? 'não concluída' : 'concluída'}`}
                />
                 {isEditing ? (
                    <Input 
                        ref={inputRef}
                        value={text}
                        onChange={e => setText(e.target.value)}
                        onBlur={handleUpdate}
                        onKeyDown={e => e.key === 'Enter' && handleUpdate()}
                        className="h-8 text-sm bg-transparent"
                    />
                ) : (
                    <label
                        htmlFor={`subtask-label-${subtask.id}`}
                        onDoubleClick={() => setIsEditing(true)}
                        className={cn('text-sm font-medium leading-none w-full cursor-pointer', {
                            'line-through text-muted-foreground': subtask.completed,
                        })}
                    >
                        {subtask.text}
                    </label>
                )}
            </div>
             <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-50 hover:!opacity-100 flex-shrink-0" onClick={onDelete}>
                <Trash2 className="h-4 w-4"/>
            </Button>
        </div>
    );
};

const EditTaskDialog: FC<{ task: Task; onUpdateTask: (taskId: string, updates: Partial<Task>) => void; }> = ({ task, onUpdateTask }) => {
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState(task.title);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (title.trim() && !loading) {
            setLoading(true);
            await onUpdateTask(task.id, { title: title.trim() });
            setLoading(false);
            setOpen(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar Tarefa
                </DropdownMenuItem>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Editar Tarefa</DialogTitle>
                    <DialogDescription>
                       Altere o título da sua tarefa.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="title" className="text-right">
                            Título
                        </Label>
                        <Input
                            id="title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="col-span-3"
                            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                            disabled={loading}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleSubmit} disabled={loading}>
                        {loading ? 'Salvando...' : 'Salvar Alterações'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


const KanbanTaskCard: FC<{
  task: Task;
  columns: Column[];
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  onDeleteTask: (taskId: string) => void;
  onAddSubtask: (taskId: string, text: string) => void;
  onUpdateSubtask: (taskId: string, subtaskId: string, updates: Partial<Subtask>) => void;
  onDeleteSubtask: (subtaskId: string) => void;
}> = ({ task, columns, onUpdateTask, onDeleteTask, onAddSubtask, onUpdateSubtask, onDeleteSubtask }) => {
  const [newSubtaskText, setNewSubtaskText] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isEditingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isEditingTitle]);

  const handleTitleUpdate = () => {
    if (title.trim() && title.trim() !== task.title) {
        onUpdateTask(task.id, { title: title.trim() });
    }
    setIsEditingTitle(false);
  }

  const handleSubtaskToggle = (subtaskId: string, completed: boolean) => {
    onUpdateSubtask(task.id, subtaskId, { completed: !completed });
  };
  
  const handleSubtaskDelete = (subtaskId: string) => {
    onDeleteSubtask(subtaskId);
  };

  const handleSubtaskUpdateText = (subtaskId: string, newText: string) => {
      onUpdateSubtask(task.id, subtaskId, { text: newText });
  }

  const handleAddSubtask = () => {
    if (newSubtaskText.trim()) {
        onAddSubtask(task.id, newSubtaskText.trim());
        setNewSubtaskText('');
    }
  };

  const handleSuggestSubtasks = useCallback(async () => {
    setIsSuggesting(true);
    try {
      const result = await suggestSubtasks({ taskTitle: task.title });
      if (result.subtasks && result.subtasks.length > 0) {
        // Batch insert new subtasks
        for (const subtaskText of result.subtasks) {
          await onAddSubtask(task.id, subtaskText);
        }
        toast({ title: "Subtarefas sugeridas!", description: `${result.subtasks.length} novas subtarefas foram adicionadas.` });
      } else {
        toast({ title: "Nenhuma sugestão", description: "A IA não conseguiu gerar sugestões para esta tarefa.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error suggesting subtasks:", error);
      toast({ title: "Erro na Sugestão", description: "Não foi possível obter sugestões da IA.", variant: "destructive" });
    } finally {
      setIsSuggesting(false);
    }
  }, [task.id, task.title, onAddSubtask, toast]);
  
  const handleMoveTask = (newColumnId: ColumnId) => {
    onUpdateTask(task.id, { column_id: newColumnId });
  };

  const completionPercentage = useMemo(() => {
    if (task.subtasks.length === 0) return 0;
    const completedCount = task.subtasks.filter((s) => s.completed).length;
    return Math.round((completedCount / task.subtasks.length) * 100);
  }, [task.subtasks]);

  const handleDragStart = (e: DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('taskId', task.id);
  }
  
  const sortedSubtasks = useMemo(() => {
    return [...task.subtasks].sort((a, b) => {
      if (a.completed === b.completed) return 0;
      return a.completed ? 1 : -1;
    });
  }, [task.subtasks]);


  return (
    <Card 
      className="mb-4 bg-card/70 hover:shadow-lg hover:shadow-primary/10 transition-shadow duration-300 border border-transparent hover:border-primary/30"
      draggable
      onDragStart={handleDragStart}
    >
        <CardHeader className="p-4 flex flex-row items-start justify-between">
            <div className="flex-grow" onDoubleClick={() => setIsEditingTitle(true)}>
                {isEditingTitle ? (
                    <Input
                        ref={titleInputRef}
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        onBlur={handleTitleUpdate}
                        onKeyDown={e => e.key === 'Enter' && handleTitleUpdate()}
                        className="text-base font-semibold h-9"
                    />
                ) : (
                    <>
                        <CardTitle className="text-base font-semibold cursor-pointer">{task.title}</CardTitle>
                        {task.subtasks.length > 0 && (
                             <CardDescription className="text-xs mt-1">
                                {task.subtasks.filter(s => s.completed).length} de {task.subtasks.length} concluídas
                            </CardDescription>
                        )}
                    </>
                )}
            </div>
            <div className="flex items-center ml-2">
                <div className="text-muted-foreground hover:text-foreground transition-colors cursor-grab active:cursor-grabbing">
                    <GripVertical className="h-5 w-5" />
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Ações</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={handleSuggestSubtasks} disabled={isSuggesting}>
                            <Lightbulb className={cn("mr-2 h-4 w-4", { "animate-pulse": isSuggesting })} />
                            Sugerir Subtarefas (IA)
                        </DropdownMenuItem>
                        <EditTaskDialog task={task} onUpdateTask={onUpdateTask} />
                        <DropdownMenuLabel>Mover para</DropdownMenuLabel>
                        {columns
                            .filter((col) => col.id !== task.column_id)
                            .map((col) => (
                            <DropdownMenuItem key={col.id} onClick={() => handleMoveTask(col.id)}>
                                {col.title}
                            </DropdownMenuItem>
                            ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => onDeleteTask(task.id)}>
                             <Trash2 className="mr-2 h-4 w-4" />
                            Excluir Tarefa
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {task.subtasks.length > 0 && (
            <div className="w-full bg-muted rounded-full h-1.5 mb-4 overflow-hidden">
                <div 
                  className={cn("h-1.5 rounded-full transition-all duration-500", {
                    "bg-green-500": completionPercentage === 100,
                    "bg-primary": completionPercentage > 0 && completionPercentage < 100,
                  })} 
                  style={{ width: `${completionPercentage}%` }} 
                />
            </div>
        )}
        <Collapsible>
            {task.subtasks.length > 0 && 
              <CollapsibleTrigger className="text-sm text-muted-foreground hover:text-foreground transition-colors w-full text-left mb-2">
                Subtarefas ({task.subtasks.length})
              </CollapsibleTrigger>
            }
            <CollapsibleContent>
                <div className="space-y-1">
                {sortedSubtasks.map((subtask) => (
                    <SubtaskItem
                        key={subtask.id}
                        subtask={subtask}
                        onToggle={() => handleSubtaskToggle(subtask.id, subtask.completed)}
                        onDelete={() => handleSubtaskDelete(subtask.id)}
                        onUpdateText={(newText) => handleSubtaskUpdateText(subtask.id, newText)}
                    />
                ))}
                </div>
            </CollapsibleContent>
        </Collapsible>

        <div className="mt-4 space-y-2">
            <div className="flex gap-2">
                <Input 
                    placeholder="Adicionar uma nova subtarefa..."
                    value={newSubtaskText}
                    onChange={e => setNewSubtaskText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddSubtask()}
                    className="h-9"
                />
                <Button variant="secondary" onClick={handleAddSubtask} className="h-9">Adicionar</Button>
            </div>
        </div>
      </CardContent>
    </Card>
  );
};


const KanbanColumn: FC<{
  column: Column;
  tasks: Task[];
  allColumns: Column[];
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  onDeleteTask: (taskId: string) => void;
  onAddSubtask: (taskId: string, text: string) => void;
  onUpdateSubtask: (taskId: string, subtaskId: string, updates: Partial<Subtask>) => void;
  onDeleteSubtask: (subtaskId: string) => void;
  onDropTask: (e: DragEvent<HTMLDivElement>, columnId: ColumnId) => void;
}> = ({ column, tasks, allColumns, onUpdateTask, onDeleteTask, onAddSubtask, onUpdateSubtask, onDeleteSubtask, onDropTask }) => {
    const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.currentTarget.classList.add('bg-primary/10');
    }

    const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
        e.currentTarget.classList.remove('bg-primary/10');
    }
    
    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        e.currentTarget.classList.remove('bg-primary/10');
        onDropTask(e, column.id);
    }
    
    return (
        <div className="w-full md:w-1/3 flex flex-col">
            <div className="p-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center">
                {column.title}
                <span className="ml-2 text-sm font-normal bg-muted text-muted-foreground rounded-full px-2 py-0.5">
                {tasks.length}
                </span>
            </h2>
            </div>
            <div 
                className="flex-grow p-4 pt-0 bg-background rounded-lg min-h-[200px] overflow-y-auto transition-colors"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
            {tasks.map((task) => (
                <KanbanTaskCard
                    key={task.id}
                    task={task}
                    columns={allColumns}
                    onUpdateTask={onUpdateTask}
                    onDeleteTask={onDeleteTask}
                    onAddSubtask={onAddSubtask}
                    onUpdateSubtask={onUpdateSubtask}
                    onDeleteSubtask={onDeleteSubtask}
                />
            ))}
            </div>
        </div>
    );
}

// --- MAIN PAGE COMPONENT ---
export default function KanbanPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [columns] = useState<Column[]>(initialColumns);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const user = sessionStorage.getItem('user');
    if (!user) {
      router.replace('/login');
    }
  }, [router]);

  const fetchTasks = useCallback(async () => {
    setIsSyncing(true);
    const { data: tasksData, error: fetchError } = await supabase
      .from('tasks')
      .select('*, subtasks(*)')
      .order('created_at', { ascending: true });
  
    if (fetchError) {
      console.error('Error fetching tasks:', fetchError);
      toast({ title: 'Error', description: 'Failed to load tasks.', variant: 'destructive' });
      setTasks([]);
    } else if (tasksData) {
      setTasks(tasksData.map(t => ({...t, subtasks: t.subtasks || []})) as Task[]);
    } else {
      setTasks([]);
    }
    setLoading(false);
    setIsSyncing(false);
  }, [toast]);

  useEffect(() => {
    fetchTasks();
    
    const channel = supabase.channel('realtime-tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
          console.log('Task change received!', payload);
          fetchTasks();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subtasks' }, (payload) => {
          console.log('Subtask change received!', payload);
          fetchTasks();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    }
  }, [fetchTasks]);

  const handleAddTask = async (title: string) => {
    const { data, error } = await supabase
      .from('tasks')
      .insert({ title, column_id: 'todo' })
      .select()
      .single();

    if (error) {
      console.error('Error adding task:', error);
      toast({ title: 'Error', description: 'Failed to add task.', variant: 'destructive' });
    } else if (data) {
        setTasks(prev => [...prev, {...data, subtasks: []} as Task]);
    }
  };

  const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
    // Optimistic update
    setTasks(prevTasks =>
        prevTasks.map(task =>
            task.id === taskId ? { ...task, ...updates } : task
        )
    );
    
    const { error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', taskId);
      
    if (error) {
      console.error('Error updating task:', error);
      toast({ title: 'Error', description: 'Failed to update task.', variant: 'destructive' });
      // Revert on error
      fetchTasks();
    }
  };
  
  const handleDeleteTask = async (taskId: string) => {
     setTasks(prev => prev.filter(t => t.id !== taskId));
     const { error } = await supabase.from('tasks').delete().eq('id', taskId);
     if (error) {
      console.error('Error deleting task:', error);
      toast({ title: 'Error', description: 'Failed to delete task.', variant: 'destructive' });
      fetchTasks();
    }
  };
  
  const handleDropTask = (e: DragEvent<HTMLDivElement>, columnId: ColumnId) => {
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) {
        handleUpdateTask(taskId, { column_id: columnId });
    }
  }
  
  const handleAddSubtask = async (taskId: string, text: string) => {
    const { data, error } = await supabase
      .from('subtasks')
      .insert({ task_id: taskId, text, completed: false })
      .select()
      .single();

    if (error) {
        console.error('Error adding subtask:', error);
        toast({ title: 'Error', description: 'Failed to add subtask.', variant: 'destructive' });
    } else if (data) {
        setTasks(prev => prev.map(t => t.id === taskId ? {...t, subtasks: [...t.subtasks, data]} : t));
    }
  }

  const handleUpdateSubtask = async (taskId: string, subtaskId: string, updates: Partial<Subtask>) => {
    let originalTask: Task | undefined;
    let updatedTask: Task | undefined;

    setTasks(prevTasks => {
        return prevTasks.map(task => {
            if (task.id === taskId) {
                originalTask = JSON.parse(JSON.stringify(task)); // Deep copy for revert
                const newSubtasks = task.subtasks.map(subtask =>
                    subtask.id === subtaskId ? { ...subtask, ...updates } : subtask
                );
                updatedTask = { ...task, subtasks: newSubtasks };
                return updatedTask;
            }
            return task;
        });
    });

    const { error } = await supabase
        .from('subtasks')
        .update(updates)
        .eq('id', subtaskId);

    if (error) {
        console.error('Error updating subtask:', error);
        toast({ title: 'Error', description: 'Failed to update subtask.', variant: 'destructive' });
        if(originalTask){
            setTasks(prevTasks => prevTasks.map(t => t.id === taskId ? originalTask! : t));
        }
        return;
    }
    
    // After successful subtask update, check if task column needs to be moved
    if (updatedTask && originalTask) {
        let newColumnId: ColumnId | null = null;
        const wasInTodo = originalTask.column_id === 'todo';
        const wasInDone = originalTask.column_id === 'done';
        
        const isAnySubtaskCompleted = updatedTask.subtasks.some(s => s.completed);
        const areAllSubtasksCompleted = updatedTask.subtasks.length > 0 && updatedTask.subtasks.every(s => s.completed);

        if (wasInTodo && isAnySubtaskCompleted) {
            newColumnId = 'in-progress';
        } else if (!wasInDone && areAllSubtasksCompleted) {
            newColumnId = 'done';
        } else if (wasInDone && !areAllSubtasksCompleted) {
            newColumnId = 'in-progress';
        }

        if (newColumnId && newColumnId !== updatedTask.column_id) {
            handleUpdateTask(taskId, { column_id: newColumnId });
        }
    }
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    let taskId: string | null = null;
    setTasks(prev => prev.map(t => {
        const subtaskExists = t.subtasks.some(s => s.id === subtaskId);
        if (subtaskExists) {
            taskId = t.id;
            return { ...t, subtasks: t.subtasks.filter(s => s.id !== subtaskId) };
        }
        return t;
    }));

    const { error } = await supabase
        .from('subtasks')
        .delete()
        .eq('id', subtaskId);

    if (error) {
        console.error('Error deleting subtask:', error);
        toast({ title: 'Error', description: 'Failed to delete subtask.', variant: 'destructive' });
        if (taskId) fetchTasks(); // Re-fetch all on error to be safe
    }
  }

  const tasksByColumn = useMemo(
    () =>
      tasks.reduce((acc, task) => {
        if (!acc[task.column_id]) {
          acc[task.column_id] = [];
        }
        acc[task.column_id].push(task);
        return acc;
      }, {} as Record<ColumnId, Task[]>),
    [tasks]
  );

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <AppHeader onAddTask={handleAddTask} onRefresh={fetchTasks} isSyncing={isSyncing} />
        <div className="flex justify-center items-center flex-grow">
            <div className="text-center">
                <p className="text-foreground mb-4">Carregando tarefas...</p>
                <RefreshCw className="h-6 w-6 text-primary animate-spin inline-block"/>
            </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <AppHeader onAddTask={handleAddTask} onRefresh={fetchTasks} isSyncing={isSyncing} />
      <main className="flex-grow p-4 overflow-x-auto">
        <div className="flex flex-col md:flex-row md:space-x-4 min-w-max md:min-w-full h-full">
          {columns.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              tasks={tasksByColumn[column.id] || []}
              allColumns={columns}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
              onAddSubtask={handleAddSubtask}
              onUpdateSubtask={handleUpdateSubtask}
              onDeleteSubtask={handleDeleteSubtask}
              onDropTask={handleDropTask}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
