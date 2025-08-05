'use client';

import { useState, useEffect, useMemo, type FC, type DragEvent } from 'react';
import { GripVertical, Plus, MoreHorizontal, Sparkles, Loader2, Trash2 } from 'lucide-react';

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
import { useToast } from '@/hooks/use-toast';
import { suggestSubtasks } from '@/ai/flows/suggest-subtasks';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

// --- TYPES ---
type ColumnId = 'todo' | 'in-progress' | 'done';

type Subtask = {
  id: string;
  text: string;
  completed: boolean;
};

type Task = {
  id: string;
  title: string;
  columnId: ColumnId;
  subtasks: Subtask[];
};

type Column = {
  id: ColumnId;
  title: string;
};

// --- INITIAL DATA ---
const initialTasks: Task[] = [
  {
    id: 'task-1',
    title: 'Design the landing page',
    columnId: 'todo',
    subtasks: [
      { id: 'sub-1-1', text: 'Create wireframes', completed: true },
      { id: 'sub-1-2', text: 'Design mockups in Figma', completed: false },
    ],
  },
  {
    id: 'task-2',
    title: 'Develop the authentication flow',
    columnId: 'in-progress',
    subtasks: [
        { id: 'sub-2-1', text: 'Set up Firebase Auth', completed: true },
        { id: 'sub-2-2', text: 'Create login page UI', completed: true },
        { id: 'sub-2-3', text: 'Create registration page UI', completed: false },
    ],
  },
  {
    id: 'task-3',
    title: 'Deploy the backend service',
    columnId: 'done',
    subtasks: [{ id: 'sub-3-1', text: 'Configure Vercel environment', completed: true }],
  },
  {
    id: 'task-4',
    title: 'Write documentation for the API',
    columnId: 'todo',
    subtasks: [],
  },
];

const initialColumns: Column[] = [
  { id: 'todo', title: '📋 A fazer' },
  { id: 'in-progress', title: '🚧 Em Progresso' },
  { id: 'done', title: '✅ Concluído' },
];

// --- SUB-COMPONENTS ---

const AppHeader: FC<{ onAddTask: (title: string) => void }> = ({ onAddTask }) => (
  <header className="flex items-center justify-between p-4 border-b">
    <h1 className="text-2xl font-bold text-foreground">Banco de Tarefas</h1>
    <CreateTaskDialog onAddTask={onAddTask} />
  </header>
);

const CreateTaskDialog: FC<{ onAddTask: (title: string) => void }> = ({ onAddTask }) => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');

  const handleSubmit = () => {
    if (title.trim()) {
      onAddTask(title.trim());
      setTitle('');
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
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit}>Create Task</Button>
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
  onMoveTask: (taskId: string, newColumnId: ColumnId) => void;
  onDeleteTask: (taskId: string) => void;
}> = ({ task, columns, onUpdateTask, onMoveTask, onDeleteTask }) => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [newSubtaskText, setNewSubtaskText] = useState('');

  const handleSubtaskToggle = (subtaskId: string) => {
    const updatedSubtasks = task.subtasks.map((sub) =>
      sub.id === subtaskId ? { ...sub, completed: !sub.completed } : sub
    );
    onUpdateTask(task.id, { subtasks: updatedSubtasks });
  };
  
  const handleSubtaskDelete = (subtaskId: string) => {
    const updatedSubtasks = task.subtasks.filter((sub) => sub.id !== subtaskId);
    onUpdateTask(task.id, { subtasks: updatedSubtasks });
  };


  const handleAiSuggest = async () => {
    setIsGenerating(true);
    try {
      const result = await suggestSubtasks({ taskTitle: task.title });
      const newSubtasks = result.subtasks.map((text) => ({
        id: crypto.randomUUID(),
        text,
        completed: false,
      }));
      onUpdateTask(task.id, { subtasks: [...task.subtasks, ...newSubtasks] });
      toast({
        title: 'Subtasks suggested by AI',
        description: `${newSubtasks.length} new subtasks have been added.`,
      });
    } catch (e) {
      console.error(e);
      toast({
        variant: 'destructive',
        title: 'AI Suggestion Failed',
        description: 'Could not generate subtasks. Please try again.',
      });
    } finally {
      setIsGenerating(false);
    }
  };
  
  const handleAddSubtask = () => {
    if (newSubtaskText.trim()) {
        const newSubtask = { id: crypto.randomUUID(), text: newSubtaskText.trim(), completed: false };
        onUpdateTask(task.id, { subtasks: [...task.subtasks, newSubtask] });
        setNewSubtaskText('');
    }
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
                            .filter((col) => col.id !== task.columnId)
                            .map((col) => (
                            <DropdownMenuItem key={col.id} onClick={() => onMoveTask(task.id, col.id)}>
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
                    onToggle={() => handleSubtaskToggle(subtask.id)}
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
            <Button variant="outline" size="sm" onClick={handleAiSuggest} disabled={isGenerating} className="w-full">
                {isGenerating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <Sparkles className="mr-2 h-4 w-4 text-primary/70" />
                )}
                Suggest Subtasks with AI
            </Button>
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
  onMoveTask: (taskId: string, newColumnId: ColumnId) => void;
  onDeleteTask: (taskId: string) => void;
  onDropTask: (e: DragEvent<HTMLDivElement>, columnId: ColumnId) => void;
}> = ({ column, tasks, allColumns, onUpdateTask, onMoveTask, onDeleteTask, onDropTask }) => {
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
                onMoveTask={onMoveTask}
                onDeleteTask={onDeleteTask}
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
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const savedTasks = localStorage.getItem('kanban-tasks');
    setTasks(savedTasks ? JSON.parse(savedTasks) : initialTasks);
  }, []);

  useEffect(() => {
    if (isClient) {
        localStorage.setItem('kanban-tasks', JSON.stringify(tasks));
    }
  }, [tasks, isClient]);


  const handleAddTask = (title: string) => {
    const newTask: Task = {
      id: crypto.randomUUID(),
      title,
      columnId: 'todo',
      subtasks: [],
    };
    setTasks((prev) => [...prev, newTask]);
  };

  const handleUpdateTask = (taskId: string, updates: Partial<Task>) => {
    setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, ...updates } : task)));
  };

  const handleMoveTask = (taskId: string, newColumnId: ColumnId) => {
    setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, columnId: newColumnId } : task)));
  };
  
  const handleDeleteTask = (taskId: string) => {
    setTasks(prev => prev.filter(task => task.id !== taskId));
  };
  
  const handleDropTask = (e: DragEvent<HTMLDivElement>, columnId: ColumnId) => {
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) {
        handleMoveTask(taskId, columnId);
    }
  }

  const tasksByColumn = useMemo(
    () =>
      tasks.reduce((acc, task) => {
        if (!acc[task.columnId]) {
          acc[task.columnId] = [];
        }
        acc[task.columnId].push(task);
        return acc;
      }, {} as Record<ColumnId, Task[]>),
    [tasks]
  );

  if (!isClient) {
    return null;
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
              onMoveTask={handleMoveTask}
              onDeleteTask={handleDeleteTask}
              onDropTask={handleDropTask}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
