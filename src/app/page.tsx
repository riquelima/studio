'use client';

import { useState, useEffect, useMemo, type FC, type DragEvent } from 'react';
import { GripVertical, Plus, MoreHorizontal, Trash2 } from 'lucide-react';

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

const AppHeader: FC<{ onAddTask: (title: string) => Promise<void> }> = ({ onAddTask }) => (
  <header className="flex items-center justify-between p-4 border-b">
    <h1 className="text-2xl font-bold text-foreground">Banco de Tarefas</h1>
    <CreateTaskDialog onAddTask={onAddTask} />
  </header>
);

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
          New Task
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>
            Enter a title for your new task. You can add subtasks later.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="title" className="text-right">
              Title
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
            {loading ? 'Creating...' : 'Create Task'}
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
}> = ({ subtask, onToggle, onDelete }) => (
    <div className="flex items-center justify-between p-2 rounded-md hover:bg-white/5 transition-colors">
        <div className="flex items-center gap-3">
            <Checkbox id={subtask.id} checked={subtask.completed} onCheckedChange={onToggle} />
            <label
                htmlFor={subtask.id}
                className={cn('text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70', {
                    'line-through text-muted-foreground': subtask.completed,
                })}
            >
                {subtask.text}
            </label>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-50 hover:opacity-100" onClick={onDelete}>
            <Trash2 className="h-4 w-4"/>
        </Button>
    </div>
);


const KanbanTaskCard: FC<{
  task: Task;
  columns: Column[];
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  onDeleteTask: (taskId: string) => void;
  onAddSubtask: (taskId: string, text: string) => void;
  onUpdateSubtask: (subtaskId: string, updates: Partial<Subtask>) => void;
  onDeleteSubtask: (subtaskId: string) => void;
}> = ({ task, columns, onUpdateTask, onDeleteTask, onAddSubtask, onUpdateSubtask, onDeleteSubtask }) => {
  const [newSubtaskText, setNewSubtaskText] = useState('');

  const handleSubtaskToggle = (subtaskId: string, completed: boolean) => {
    onUpdateSubtask(subtaskId, { completed: !completed });
  };
  
  const handleSubtaskDelete = (subtaskId: string) => {
    onDeleteSubtask(subtaskId);
  };

  const handleAddSubtask = () => {
    if (newSubtaskText.trim()) {
        onAddSubtask(task.id, newSubtaskText.trim());
        setNewSubtaskText('');
    }
  };
  
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

  return (
    <Card 
      className="mb-4 bg-card/70 hover:shadow-lg hover:shadow-primary/10 transition-shadow duration-300 border border-transparent hover:border-primary/30 cursor-grab active:cursor-grabbing"
      draggable
      onDragStart={handleDragStart}
    >
        <CardHeader className="p-4 flex flex-row items-start justify-between">
            <div>
                <CardTitle className="text-base font-semibold">{task.title}</CardTitle>
                {task.subtasks.length > 0 && (
                     <CardDescription className="text-xs mt-1">
                        {task.subtasks.filter(s => s.completed).length} of {task.subtasks.length} completed
                    </CardDescription>
                )}
            </div>
            <div className="flex items-center">
                <div className="text-muted-foreground hover:text-foreground transition-colors">
                    <GripVertical className="h-5 w-5" />
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {columns
                            .filter((col) => col.id !== task.column_id)
                            .map((col) => (
                            <DropdownMenuItem key={col.id} onClick={() => handleMoveTask(col.id)}>
                                Move to "{col.title}"
                            </DropdownMenuItem>
                            ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => onDeleteTask(task.id)}>
                            Delete Task
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {task.subtasks.length > 0 && (
            <div className="w-full bg-muted rounded-full h-1.5 mb-4 overflow-hidden">
                <div className="bg-primary h-1.5 rounded-full transition-all duration-500" style={{ width: `${completionPercentage}%` }} />
            </div>
        )}
        <Collapsible>
            {task.subtasks.length > 0 && <CollapsibleTrigger className="text-sm text-muted-foreground hover:text-foreground transition-colors w-full text-left mb-2">
                Sub-tasks ({task.subtasks.length})
            </CollapsibleTrigger>}
            <CollapsibleContent>
                <div className="space-y-1">
                {task.subtasks.map((subtask) => (
                    <SubtaskItem
                    key={subtask.id}
                    subtask={subtask}
                    onToggle={() => handleSubtaskToggle(subtask.id, subtask.completed)}
                    onDelete={() => handleSubtaskDelete(subtask.id)}
                    />
                ))}
                </div>
            </CollapsibleContent>
        </Collapsible>

        <div className="mt-4 space-y-2">
            <div className="flex gap-2">
                <Input 
                    placeholder="Add a new subtask..."
                    value={newSubtaskText}
                    onChange={e => setNewSubtaskText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddSubtask()}
                    className="h-9"
                />
                <Button variant="secondary" onClick={handleAddSubtask} className="h-9">Add</Button>
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
  onUpdateSubtask: (subtaskId: string, updates: Partial<Subtask>) => void;
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
  const { toast } = useToast();

  const fetchTasks = async () => {
    const { data: tasksData, error } = await supabase
      .from('tasks')
      .select('*, subtasks(*)')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching tasks:', error);
      toast({ title: 'Error', description: 'Failed to load tasks.', variant: 'destructive' });
      setTasks([]);
    } else {
      setTasks(tasksData as Task[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTasks();
    
    const channel = supabase.channel('realtime-tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, fetchTasks)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subtasks' }, fetchTasks)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    }
  }, []);

  const handleAddTask = async (title: string) => {
    const { data, error } = await supabase
      .from('tasks')
      .insert({ title, column_id: 'todo' })
      .select()
      .single();
      
    if (error) {
      console.error('Error adding task:', error);
      toast({ title: 'Error', description: 'Failed to add task.', variant: 'destructive' });
    }
  };

  const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
    const { error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', taskId);
      
    if (error) {
      console.error('Error updating task:', error);
      toast({ title: 'Error', description: 'Failed to update task.', variant: 'destructive' });
    }
  };
  
  const handleDeleteTask = async (taskId: string) => {
     const { error } = await supabase.from('tasks').delete().eq('id', taskId);
     if (error) {
      console.error('Error deleting task:', error);
      toast({ title: 'Error', description: 'Failed to delete task.', variant: 'destructive' });
    }
  };
  
  const handleDropTask = (e: DragEvent<HTMLDivElement>, columnId: ColumnId) => {
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) {
        handleUpdateTask(taskId, { column_id: columnId });
    }
  }
  
  const handleAddSubtask = async (taskId: string, text: string) => {
    const { error } = await supabase
      .from('subtasks')
      .insert({ task_id: taskId, text, completed: false });

    if (error) {
        console.error('Error adding subtask:', error);
        toast({ title: 'Error', description: 'Failed to add subtask.', variant: 'destructive' });
    }
  }

  const handleUpdateSubtask = async (subtaskId: string, updates: Partial<Subtask>) => {
    const { error } = await supabase
        .from('subtasks')
        .update(updates)
        .eq('id', subtaskId);

    if (error) {
        console.error('Error updating subtask:', error);
        toast({ title: 'Error', description: 'Failed to update subtask.', variant: 'destructive' });
    }
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    const { error } = await supabase
        .from('subtasks')
        .delete()
        .eq('id', subtaskId);

    if (error) {
        console.error('Error deleting subtask:', error);
        toast({ title: 'Error', description: 'Failed to delete subtask.', variant: 'destructive' });
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
        <div className="flex justify-center items-center h-screen bg-background">
            <p className="text-foreground">Loading tasks...</p>
        </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <AppHeader onAddTask={handleAddTask} />
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
