import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

const API_BASE = 'https://functions.poehali.dev';
const AUTH_URL = `${API_BASE}/266387fb-4add-43d9-aa3a-5965e287a151`;
const CHATS_URL = `${API_BASE}/4aa94d3b-a429-4dfe-a6e5-329b8b09d317`;
const MESSAGES_URL = `${API_BASE}/fd8314a4-0d2b-4636-b3c6-afd2ab8750de`;
const EMPLOYEES_URL = `${API_BASE}/2a92d690-5999-45f3-854b-5ed8accefa75`;
const HISTORY_URL = `${API_BASE}/d1128593-3ef8-4ab8-a946-44fabaadb4d9`;

interface Employee {
  id: number;
  login: string;
  name: string;
  role: string;
  status: string;
}

interface Chat {
  id: number;
  user_name: string;
  user_email: string;
  status: string;
  assigned_to: number | null;
  operator_name: string | null;
  created_at: string;
  is_closed?: boolean;
  resolution_status?: string | null;
}

interface HistoryItem {
  id: number;
  action: string;
  details: string;
  created_at: string;
  employee_name: string | null;
}

interface Message {
  id: number;
  sender_type: string;
  message: string;
  created_at: string;
  sender_name: string | null;
}

export default function Index() {
  const [view, setView] = useState<'user' | 'login' | 'operator' | 'admin'>('user');
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);
  
  const [loginForm, setLoginForm] = useState({ login: '', password: '' });
  const [userChatForm, setUserChatForm] = useState({ name: '', email: '', message: '' });
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  
  const [newEmployee, setNewEmployee] = useState({ login: '', password: '', name: '', role: 'operator' });

  useEffect(() => {
    if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'operator')) {
      loadEmployees();
      loadChats();
    }
  }, [currentUser]);

  useEffect(() => {
    if (selectedChat) {
      loadMessages(selectedChat.id);
      loadHistory(selectedChat.id);
    }
  }, [selectedChat]);

  const loadHistory = async (chatId: number) => {
    const res = await fetch(`${HISTORY_URL}?chat_id=${chatId}`);
    const data = await res.json();
    setHistory(data);
  };

  const loadEmployees = async () => {
    const res = await fetch(EMPLOYEES_URL);
    const data = await res.json();
    setEmployees(data);
  };

  const loadChats = async () => {
    const url = currentUser?.role === 'operator' 
      ? `${CHATS_URL}?operator_id=${currentUser.id}&role=operator`
      : CHATS_URL;
    const res = await fetch(url);
    const data = await res.json();
    setChats(data);
  };

  const loadMessages = async (chatId: number) => {
    const res = await fetch(`${MESSAGES_URL}?chat_id=${chatId}`);
    const data = await res.json();
    setMessages(data);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(AUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });
      
      if (res.ok) {
        const user = await res.json();
        setCurrentUser(user);
        setView(user.role === 'admin' ? 'admin' : 'operator');
        
        await fetch(EMPLOYEES_URL, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: user.id, status: 'online' })
        });
        
        toast.success('Вы успешно вошли в систему');
      } else {
        toast.error('Неверный логин или пароль');
      }
    } catch (error) {
      toast.error('Ошибка подключения');
    }
  };

  const handleUserChat = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(CHATS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_name: userChatForm.name,
          user_email: userChatForm.email,
          message: userChatForm.message
        })
      });
      
      if (res.ok) {
        toast.success('Ваше обращение отправлено');
        setUserChatForm({ name: '', email: '', message: '' });
      }
    } catch (error) {
      toast.error('Ошибка отправки');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChat || !newMessage.trim()) return;
    
    try {
      await fetch(MESSAGES_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: selectedChat.id,
          sender_type: 'operator',
          sender_id: currentUser?.id,
          message: newMessage
        })
      });
      
      setNewMessage('');
      loadMessages(selectedChat.id);
    } catch (error) {
      toast.error('Ошибка отправки сообщения');
    }
  };

  const handleCloseChat = async (resolution: 'solved' | 'unsolved') => {
    if (!selectedChat || !currentUser) return;
    
    try {
      await fetch(CHATS_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'close',
          chat_id: selectedChat.id,
          resolution_status: resolution,
          employee_id: currentUser.id
        })
      });
      
      toast.success(resolution === 'solved' ? 'Чат закрыт как решенный' : 'Чат закрыт как нерешенный');
      setSelectedChat(null);
      loadChats();
    } catch (error) {
      toast.error('Ошибка закрытия чата');
    }
  };

  const handleStatusChange = async (employeeId: number, status: string) => {
    try {
      await fetch(EMPLOYEES_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: employeeId, status })
      });
      loadEmployees();
      toast.success('Статус обновлен');
    } catch (error) {
      toast.error('Ошибка обновления статуса');
    }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch(EMPLOYEES_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEmployee)
      });
      setNewEmployee({ login: '', password: '', name: '', role: 'operator' });
      loadEmployees();
      toast.success('Сотрудник добавлен');
    } catch (error) {
      toast.error('Ошибка добавления сотрудника');
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      online: 'bg-green-500',
      offline: 'bg-gray-500',
      break: 'bg-yellow-500'
    };
    return <Badge className={`${colors[status]} text-white`}>{status}</Badge>;
  };

  if (view === 'user') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Icon name="MessageSquare" size={28} />
              Чат поддержки
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUserChat} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Ваше имя</label>
                <Input
                  value={userChatForm.name}
                  onChange={e => setUserChatForm({ ...userChatForm, name: e.target.value })}
                  placeholder="Введите ваше имя"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Email (необязательно)</label>
                <Input
                  type="email"
                  value={userChatForm.email}
                  onChange={e => setUserChatForm({ ...userChatForm, email: e.target.value })}
                  placeholder="your@email.com"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Ваш вопрос</label>
                <Textarea
                  value={userChatForm.message}
                  onChange={e => setUserChatForm({ ...userChatForm, message: e.target.value })}
                  placeholder="Опишите вашу проблему"
                  rows={6}
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="flex-1">
                  <Icon name="Send" size={18} className="mr-2" />
                  Отправить
                </Button>
                <Button type="button" variant="outline" onClick={() => setView('login')}>
                  Я сотрудник
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (view === 'login') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon name="Lock" size={24} />
              Вход для сотрудников
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Логин</label>
                <Input
                  value={loginForm.login}
                  onChange={e => setLoginForm({ ...loginForm, login: e.target.value })}
                  placeholder="Введите логин"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Пароль</label>
                <Input
                  type="password"
                  value={loginForm.password}
                  onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                  placeholder="Введите пароль"
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="flex-1">Войти</Button>
                <Button type="button" variant="outline" onClick={() => setView('user')}>
                  Назад
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (view === 'operator' || view === 'admin') {
    return (
      <div className="min-h-screen p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon name="Headphones" size={28} />
            <div>
              <h1 className="text-2xl font-bold">{currentUser?.name}</h1>
              <p className="text-sm text-muted-foreground">{currentUser?.role === 'admin' ? 'Администратор' : 'Оператор'}</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => {
            if (currentUser) {
              handleStatusChange(currentUser.id, 'offline');
            }
            setCurrentUser(null);
            setView('user');
          }}>
            Выйти
          </Button>
        </div>

        {view === 'admin' && (
          <Tabs defaultValue="chats" className="space-y-4">
            <TabsList>
              <TabsTrigger value="chats">Чаты</TabsTrigger>
              <TabsTrigger value="employees">Сотрудники</TabsTrigger>
            </TabsList>
            
            <TabsContent value="chats" className="space-y-0">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Список чатов</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[600px]">
                      <div className="space-y-2">
                        {chats.map(chat => (
                          <div
                            key={chat.id}
                            onClick={() => setSelectedChat(chat)}
                            className={`p-3 rounded-lg cursor-pointer transition-colors ${
                              selectedChat?.id === chat.id ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-secondary/80'
                            } ${chat.is_closed ? 'opacity-60' : ''}`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="font-medium flex items-center gap-2">
                                  {chat.user_name}
                                  {chat.is_closed && (
                                    <Icon name={chat.resolution_status === 'solved' ? 'CheckCircle' : 'XCircle'} size={14} />
                                  )}
                                </p>
                                <p className="text-xs opacity-70">{chat.user_email}</p>
                              </div>
                              <Badge variant={chat.status === 'waiting' ? 'destructive' : chat.is_closed ? 'secondary' : 'default'}>
                                {chat.is_closed ? 'закрыт' : chat.status}
                              </Badge>
                            </div>
                            {chat.operator_name && (
                              <p className="text-xs mt-1 opacity-70">
                                <Icon name="User" size={12} className="inline mr-1" />
                                {chat.operator_name}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg">
                      {selectedChat ? `Чат с ${selectedChat.user_name}` : 'Выберите чат'}
                    </CardTitle>
                    {selectedChat && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowHistory(!showHistory)}
                        >
                          <Icon name="Clock" size={16} className="mr-1" />
                          История
                        </Button>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    {selectedChat ? (
                      <div className="space-y-4">
                        {showHistory ? (
                          <ScrollArea className="h-[480px] pr-4">
                            <div className="space-y-2">
                              {history.map(item => (
                                <div key={item.id} className="p-3 bg-secondary rounded-lg">
                                  <div className="flex items-start justify-between">
                                    <div>
                                      <p className="font-medium text-sm">{item.action}</p>
                                      <p className="text-xs opacity-70">{item.details}</p>
                                      {item.employee_name && (
                                        <p className="text-xs opacity-60 mt-1">
                                          <Icon name="User" size={12} className="inline mr-1" />
                                          {item.employee_name}
                                        </p>
                                      )}
                                    </div>
                                    <p className="text-xs opacity-50">
                                      {new Date(item.created_at).toLocaleString('ru-RU')}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        ) : (
                          <>
                            <ScrollArea className="h-[420px] pr-4">
                              <div className="space-y-3">
                                {messages.map(msg => (
                                  <div
                                    key={msg.id}
                                    className={`p-3 rounded-lg ${
                                      msg.sender_type === 'user'
                                        ? 'bg-secondary ml-0 mr-12'
                                        : 'bg-primary text-primary-foreground ml-12 mr-0'
                                    }`}
                                  >
                                    <p className="text-sm font-medium opacity-70">
                                      {msg.sender_type === 'user' ? selectedChat.user_name : msg.sender_name}
                                    </p>
                                    <p>{msg.message}</p>
                                    <p className="text-xs opacity-50 mt-1">
                                      {new Date(msg.created_at).toLocaleString('ru-RU')}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </ScrollArea>
                            {!selectedChat.is_closed && (
                              <>
                                <form onSubmit={handleSendMessage} className="flex gap-2">
                                  <Input
                                    value={newMessage}
                                    onChange={e => setNewMessage(e.target.value)}
                                    placeholder="Введите сообщение..."
                                    className="flex-1"
                                  />
                                  <Button type="submit">
                                    <Icon name="Send" size={18} />
                                  </Button>
                                </form>
                                <div className="flex gap-2">
                                  <Button
                                    variant="default"
                                    onClick={() => handleCloseChat('solved')}
                                    className="flex-1"
                                  >
                                    <Icon name="CheckCircle" size={16} className="mr-2" />
                                    Решено
                                  </Button>
                                  <Button
                                    variant="outline"
                                    onClick={() => handleCloseChat('unsolved')}
                                    className="flex-1"
                                  >
                                    <Icon name="XCircle" size={16} className="mr-2" />
                                    Не решено
                                  </Button>
                                </div>
                              </>
                            )}
                            {selectedChat.is_closed && (
                              <div className="p-4 bg-secondary rounded-lg text-center">
                                <p className="text-sm font-medium">
                                  Чат закрыт как {selectedChat.resolution_status === 'solved' ? 'решенный' : 'нерешенный'}
                                </p>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="h-[540px] flex items-center justify-center text-muted-foreground">
                        <div className="text-center">
                          <Icon name="MessageSquare" size={48} className="mx-auto mb-2 opacity-50" />
                          <p>Выберите чат из списка</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="employees">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Добавить сотрудника</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleAddEmployee} className="space-y-4">
                      <div>
                        <label className="text-sm font-medium">Логин</label>
                        <Input
                          value={newEmployee.login}
                          onChange={e => setNewEmployee({ ...newEmployee, login: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Пароль</label>
                        <Input
                          type="password"
                          value={newEmployee.password}
                          onChange={e => setNewEmployee({ ...newEmployee, password: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Имя</label>
                        <Input
                          value={newEmployee.name}
                          onChange={e => setNewEmployee({ ...newEmployee, name: e.target.value })}
                          required
                        />
                      </div>
                      <Button type="submit" className="w-full">
                        <Icon name="UserPlus" size={18} className="mr-2" />
                        Добавить
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Список сотрудников</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-3">
                        {employees.map(emp => (
                          <div key={emp.id} className="p-3 bg-secondary rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <p className="font-medium">{emp.name}</p>
                                <p className="text-xs text-muted-foreground">@{emp.login}</p>
                              </div>
                              {getStatusBadge(emp.status)}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleStatusChange(emp.id, 'online')}
                                className="flex-1"
                              >
                                На линии
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleStatusChange(emp.id, 'break')}
                                className="flex-1"
                              >
                                Отдых
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleStatusChange(emp.id, 'offline')}
                                className="flex-1"
                              >
                                Offline
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        )}

        {view === 'operator' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  Мои чаты
                  <Button
                    size="sm"
                    variant={currentUser?.status === 'online' ? 'default' : 'outline'}
                    onClick={() => currentUser && handleStatusChange(
                      currentUser.id,
                      currentUser.status === 'online' ? 'break' : 'online'
                    )}
                  >
                    {currentUser?.status === 'online' ? 'На линии' : 'Отдых'}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px]">
                  <div className="space-y-2">
                    {chats.map(chat => (
                      <div
                        key={chat.id}
                        onClick={() => setSelectedChat(chat)}
                        className={`p-3 rounded-lg cursor-pointer transition-colors ${
                          selectedChat?.id === chat.id ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-secondary/80'
                        } ${chat.is_closed ? 'opacity-50' : ''}`}
                      >
                        <p className="font-medium flex items-center gap-2">
                          {chat.user_name}
                          {chat.is_closed && (
                            <Icon name={chat.resolution_status === 'solved' ? 'CheckCircle' : 'XCircle'} size={14} />
                          )}
                        </p>
                        <p className="text-xs opacity-70">{chat.user_email}</p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">
                  {selectedChat ? `Чат с ${selectedChat.user_name}` : 'Выберите чат'}
                </CardTitle>
                {selectedChat && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowHistory(!showHistory)}
                  >
                    <Icon name="Clock" size={16} className="mr-1" />
                    История
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {selectedChat ? (
                  <div className="space-y-4">
                    {showHistory ? (
                      <ScrollArea className="h-[480px] pr-4">
                        <div className="space-y-2">
                          {history.map(item => (
                            <div key={item.id} className="p-3 bg-secondary rounded-lg">
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className="font-medium text-sm">{item.action}</p>
                                  <p className="text-xs opacity-70">{item.details}</p>
                                  {item.employee_name && (
                                    <p className="text-xs opacity-60 mt-1">
                                      <Icon name="User" size={12} className="inline mr-1" />
                                      {item.employee_name}
                                    </p>
                                  )}
                                </div>
                                <p className="text-xs opacity-50">
                                  {new Date(item.created_at).toLocaleString('ru-RU')}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    ) : (
                      <>
                        <ScrollArea className="h-[420px] pr-4">
                          <div className="space-y-3">
                            {messages.map(msg => (
                              <div
                                key={msg.id}
                                className={`p-3 rounded-lg ${
                                  msg.sender_type === 'user'
                                    ? 'bg-secondary ml-0 mr-12'
                                    : 'bg-primary text-primary-foreground ml-12 mr-0'
                                }`}
                              >
                                <p className="text-sm font-medium opacity-70">
                                  {msg.sender_type === 'user' ? selectedChat.user_name : 'Вы'}
                                </p>
                                <p>{msg.message}</p>
                                <p className="text-xs opacity-50 mt-1">
                                  {new Date(msg.created_at).toLocaleString('ru-RU')}
                                </p>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                        {!selectedChat.is_closed && (
                          <>
                            <form onSubmit={handleSendMessage} className="flex gap-2">
                              <Input
                                value={newMessage}
                                onChange={e => setNewMessage(e.target.value)}
                                placeholder="Введите сообщение..."
                                className="flex-1"
                              />
                              <Button type="submit">
                                <Icon name="Send" size={18} />
                              </Button>
                            </form>
                            <div className="flex gap-2">
                              <Button
                                variant="default"
                                onClick={() => handleCloseChat('solved')}
                                className="flex-1"
                              >
                                <Icon name="CheckCircle" size={16} className="mr-2" />
                                Решено
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => handleCloseChat('unsolved')}
                                className="flex-1"
                              >
                                <Icon name="XCircle" size={16} className="mr-2" />
                                Не решено
                              </Button>
                            </div>
                          </>
                        )}
                        {selectedChat.is_closed && (
                          <div className="p-4 bg-secondary rounded-lg text-center">
                            <p className="text-sm font-medium">
                              Чат закрыт как {selectedChat.resolution_status === 'solved' ? 'решенный' : 'нерешенный'}
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="h-[540px] flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <Icon name="MessageSquare" size={48} className="mx-auto mb-2 opacity-50" />
                      <p>Выберите чат из списка</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    );
  }

  return null;
}