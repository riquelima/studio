
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, UserPlus, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

type User = {
    id: string;
    username: string;
    role: string;
    created_at: string;
}

export default function AdminUsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const router = useRouter();
    const { toast } = useToast();

    const fetchUsers = useCallback(async () => {
        setIsRefreshing(true);
        const { data, error } = await supabase.from('users').select('id, username, role, created_at');

        if (error) {
            toast({ title: 'Erro ao buscar usuários', description: error.message, variant: 'destructive' });
        } else {
            setUsers(data as User[]);
        }
        setLoading(false);
        setIsRefreshing(false);
    }, [toast]);

    useEffect(() => {
        // Protect route
        const storedUser = sessionStorage.getItem('user');
        if (!storedUser || JSON.parse(storedUser).username !== 'admin') {
            toast({ title: 'Acesso Negado', description: 'Você não tem permissão para acessar esta página.', variant: 'destructive' });
            router.replace('/login');
            return;
        }
        fetchUsers();
    }, [fetchUsers, router, toast]);

    const handleAddUser = async () => {
        if (!newUsername.trim() || !newPassword.trim()) {
            toast({ title: 'Campos obrigatórios', description: 'Por favor, preencha o nome de usuário e a senha.', variant: 'destructive' });
            return;
        }

        setIsSubmitting(true);
        
        try {
            // Check if user already exists
            const { data: existingUser, error: existingUserError } = await supabase
                .from('users')
                .select('username')
                .eq('username', newUsername.trim())
                .single();

            if (existingUser) {
                toast({ title: 'Erro ao criar usuário', description: `O nome de usuário '${newUsername.trim()}' já existe.`, variant: 'destructive' });
                setIsSubmitting(false);
                return;
            }
            
            // Insert user data into our public 'users' table
            const { error: insertError } = await supabase.from('users').insert({
                username: newUsername.trim(),
                password_hash: newPassword, // Storing password in plain text as requested
                role: newUsername.trim().toLowerCase() === 'admin' ? 'admin' : 'user'
            });

            if (insertError) {
                 throw insertError;
            }

            toast({ title: 'Sucesso!', description: `Usuário '${newUsername.trim()}' criado.` });
            setNewUsername('');
            setNewPassword('');
            fetchUsers(); // Refresh the list

        } catch (error: any) {
             toast({ title: 'Erro ao criar usuário', description: error.message, variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-background p-4 md:p-8">
            <header className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                     <Button variant="outline" size="icon" onClick={() => router.push('/kanban')}>
                        <ArrowLeft />
                    </Button>
                    <h1 className="text-2xl md:text-3xl font-bold">Gerenciamento de Usuários</h1>
                </div>
                 <Button variant="outline" size="icon" onClick={fetchUsers} disabled={isRefreshing}>
                    <RefreshCw className={cn('h-4 w-4', { 'animate-spin': isRefreshing })} />
                </Button>
            </header>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Usuários Existentes</CardTitle>
                            <CardDescription>Lista de todos os usuários cadastrados no sistema.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Usuário</TableHead>
                                        <TableHead>Cargo</TableHead>
                                        <TableHead>Criado em</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {users.length > 0 ? (
                                        users.map(user => (
                                            <TableRow key={user.id}>
                                                <TableCell className="font-medium">{user.username}</TableCell>
                                                <TableCell>
                                                    <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>{user.role}</Badge>
                                                </TableCell>
                                                <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center text-muted-foreground">Nenhum usuário encontrado.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>

                <div>
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><UserPlus size={20}/> Adicionar Novo Usuário</CardTitle>
                            <CardDescription>Crie uma nova conta de usuário. A senha será armazenada como texto simples.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="new-username">Nome de Usuário</Label>
                                <Input 
                                    id="new-username"
                                    value={newUsername}
                                    onChange={(e) => setNewUsername(e.target.value)}
                                    disabled={isSubmitting}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="new-password">Senha</Label>
                                <Input 
                                    id="new-password"
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    disabled={isSubmitting}
                                />
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button className="w-full" onClick={handleAddUser} disabled={isSubmitting}>
                                {isSubmitting ? 'Criando...' : 'Criar Usuário'}
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </div>
    );
}
