
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async () => {
    setLoading(true);

    if (!username.trim() || !password.trim()) {
        toast({ title: 'Erro de Login', description: 'Por favor, preencha usuário e senha.', variant: 'destructive' });
        setLoading(false);
        return;
    }

    try {
        // We will use a dummy email domain since Supabase Auth requires an email.
        // This is transparent to the user who still logs in with their username.
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: `${username.trim()}@bancodetarefas.com`,
            password: password,
        });
        
        if (signInError) {
             toast({
                title: 'Erro de Login',
                description: 'Usuário ou senha inválidos.',
                variant: 'destructive',
            });
            setLoading(false);
            return;
        }

        // If signIn is successful, get user details from our 'users' table
        const { data: { user } } = await supabase.auth.getUser();

        if(user){
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('*')
                .eq('id', user.id)
                .single();
            
            if (userError) throw userError;

             if (userData) {
                toast({ title: 'Sucesso!', description: 'Login realizado com sucesso.' });
                // Store user info in session storage to use across the app
                sessionStorage.setItem('user', JSON.stringify({ id: userData.id, username: userData.username, role: userData.role }));
                router.push('/kanban');
            } else {
                 throw new Error("Usuário não encontrado na tabela 'users'.");
            }

        } else {
            // This case should ideally not be reached if signInError is handled
            toast({
                title: 'Erro de Login',
                description: 'Usuário ou senha inválidos.',
                variant: 'destructive',
            });
            setLoading(false);
        }
    } catch (err: any) {
        console.error('Login error:', err);
        toast({
            title: 'Erro no Servidor',
            description: 'Não foi possível conectar ao servidor. Tente novamente mais tarde.',
            variant: 'destructive',
        });
        setLoading(false);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  }

  return (
    <div className="flex flex-col h-screen w-full items-center justify-center bg-background p-4">
      <img src="https://cdn-icons-png.flaticon.com/512/3475/3475845.png" alt="Logo Banco de Tarefas" className="w-32 h-32 mb-6" />
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Banco de Tarefas</CardTitle>
          <CardDescription>
            Entre com suas credenciais
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="username">Usuário</Label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={handleKeyDown}
              required
              disabled={loading}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              required
              disabled={loading}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button className="w-full" onClick={handleLogin} disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
