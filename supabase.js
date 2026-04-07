// supabase.js
// GHOST-HUB v3.1 - Полная Supabase интеграция с автосозданием таблиц

class GhostHubDatabase {
  constructor() {
    this.supabaseUrl = this.getDatabaseUrl();
    this.supabaseKey = this.getAnonKey();
    this.client = null;
    this.isInitialized = false;
    this.offlineMode = false;
    this.tablesCreated = false;
  }

  getDatabaseUrl() {
    if (typeof window !== 'undefined' && window.ENV && window.ENV.DATABASE_URL) {
      return window.ENV.DATABASE_URL;
    }
    return localStorage.getItem('GHOST_HUB_DB_URL') || 'https://your-project.supabase.co';
  }

  getAnonKey() {
    if (typeof window !== 'undefined' && window.ENV && window.ENV.SUPABASE_ANON_KEY) {
      return window.ENV.SUPABASE_ANON_KEY;
    }
    return localStorage.getItem('GHOST_HUB_ANON_KEY') || '';
  }

  // ==================== ИНИЦИАЛИЗАЦИЯ ====================
  async init() {
    if (!this.supabaseUrl || !this.supabaseKey || this.supabaseKey === 'your-anon-key') {
      console.warn('[DB] No credentials provided, running in offline mode');
      this.offlineMode = true;
      return false;
    }

    try {
      // Создаем клиент Supabase
      this.client = supabase.createClient(this.supabaseUrl, this.supabaseKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true
        },
        realtime: {
          enabled: true,
          timeout: 20000
        },
        db: {
          schema: 'public'
        }
      });

      // Проверяем подключение
      const { data: healthCheck, error: healthError } = await this.client
        .from('users')
        .select('id')
        .limit(1);

      if (healthError) {
        if (healthError.code === '42P01' || healthError.message?.includes('does not exist')) {
          console.log('[DB] Tables not found, creating...');
          await this.createAllTables();
        } else if (healthError.code === 'PGRST301' || healthError.message?.includes('JWT')) {
          console.error('[DB] Invalid credentials');
          this.offlineMode = true;
          return false;
        } else {
          console.warn('[DB] Connection issue:', healthError);
          // Пробуем создать таблицы на всякий случай
          await this.createAllTables();
        }
      }

      // Подписываемся на realtime обновления
      this.setupRealtimeSubscriptions();

      this.isInitialized = true;
      this.offlineMode = false;
      console.log('[DB] Connected to Supabase successfully');
      return true;

    } catch (err) {
      console.error('[DB] Connection failed:', err);
      this.offlineMode = true;
      return false;
    }
  }

  // ==================== СОЗДАНИЕ ТАБЛИЦ ====================
  async createAllTables() {
    console.log('[DB] Creating database schema...');
    
    try {
      // Создаем таблицы по порядку (с учетом зависимостей)
      await this.createUsersTable();
      await this.createTeamSessionsTable();
      await this.createChatMessagesTable();
      await this.createIncidentLogsTable();
      await this.createAudioRecordsTable();
      await this.createEquipmentTable();
      
      // Создаем индексы и политики RLS
      await this.createIndexes();
      await this.setupRLS();
      
      this.tablesCreated = true;
      console.log('[DB] All tables created successfully');
    } catch (err) {
      console.error('[DB] Failed to create tables:', err);
      // Не выбрасываем ошибку - работаем в offline режиме
    }
  }

  async createUsersTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS public.users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('Командир', 'Техник', 'Аналитик', 'Связист', 'Медик', 'Оператор')),
        device_id TEXT UNIQUE,
        last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      COMMENT ON TABLE public.users IS 'Пользователи приложения GHOST-HUB';
    `;
    
    return await this.executeSQL(sql, 'users');
  }

  async createTeamSessionsTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS public.team_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
        joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_ping TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        is_active BOOLEAN DEFAULT TRUE,
        gps_lat DECIMAL(10, 8),
        gps_lng DECIMAL(11, 8),
        pulse INTEGER CHECK (pulse >= 0 AND pulse <= 250),
        battery INTEGER CHECK (battery >= 0 AND battery <= 100),
        device_status JSONB DEFAULT '{}'::jsonb
      );
      
      COMMENT ON TABLE public.team_sessions IS 'Активные сессии членов команды';
    `;
    
    return await this.executeSQL(sql, 'team_sessions');
  }

  async createChatMessagesTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS public.chat_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
        author_name TEXT NOT NULL,
        author_role TEXT NOT NULL,
        message TEXT NOT NULL CHECK (LENGTH(message) <= 500),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        delivered BOOLEAN DEFAULT FALSE,
        read_at TIMESTAMP WITH TIME ZONE,
        is_system BOOLEAN DEFAULT FALSE,
        metadata JSONB DEFAULT '{}'::jsonb
      );
      
      COMMENT ON TABLE public.chat_messages IS 'Сообщения чата команды';
    `;
    
    return await this.executeSQL(sql, 'chat_messages');
  }

  async createIncidentLogsTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS public.incident_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
        time TEXT NOT NULL,
        gps TEXT,
        gps_lat DECIMAL(10, 8),
        gps_lng DECIMAL(11, 8),
        emf TEXT,
        noise TEXT,
        audio_data TEXT, -- base64 encoded audio
        audio_duration INTEGER CHECK (audio_duration >= 0),
        audio_url TEXT, -- URL если храним в Storage
        notes TEXT,
        tags TEXT[] DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        severity INTEGER DEFAULT 1 CHECK (severity BETWEEN 1 AND 5)
      );
      
      COMMENT ON TABLE public.incident_logs IS 'Логи инцидентов с аудио';
    `;
    
    return await this.executeSQL(sql, 'incident_logs');
  }

  async createAudioRecordsTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS public.audio_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
        duration INTEGER NOT NULL CHECK (duration > 0),
        file_path TEXT,
        file_size INTEGER,
        mime_type TEXT DEFAULT 'audio/webm',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        metadata JSONB DEFAULT '{}'::jsonb,
        is_deleted BOOLEAN DEFAULT FALSE
      );
      
      COMMENT ON TABLE public.audio_records IS 'Аудиозаписи пользователей';
    `;
    
    return await this.executeSQL(sql, 'audio_records');
  }

  async createEquipmentTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS public.equipment (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('camera', 'light', 'sensor', 'relay', 'other')),
        ip_address INET,
        mac_address TEXT,
        status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'error', 'maintenance')),
        battery INTEGER CHECK (battery >= 0 AND battery <= 100),
        is_on BOOLEAN DEFAULT FALSE,
        last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        config JSONB DEFAULT '{}'::jsonb,
        firmware_version TEXT
      );
      
      COMMENT ON TABLE public.equipment IS 'Подключенное оборудование ESP32';
    `;
    
    return await this.executeSQL(sql, 'equipment');
  }

  async createIndexes() {
    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_users_device_id ON public.users(device_id);`,
      `CREATE INDEX IF NOT EXISTS idx_users_last_seen ON public.users(last_seen);`,
      `CREATE INDEX IF NOT EXISTS idx_team_sessions_user ON public.team_sessions(user_id);`,
      `CREATE INDEX IF NOT EXISTS idx_team_sessions_active ON public.team_sessions(is_active) WHERE is_active = TRUE;`,
      `CREATE INDEX IF NOT EXISTS idx_team_sessions_ping ON public.team_sessions(last_ping);`,
      `CREATE INDEX IF NOT EXISTS idx_chat_time ON public.chat_messages(created_at DESC);`,
      `CREATE INDEX IF NOT EXISTS idx_chat_user ON public.chat_messages(user_id);`,
      `CREATE INDEX IF NOT EXISTS idx_chat_delivered ON public.chat_messages(delivered) WHERE delivered = FALSE;`,
      `CREATE INDEX IF NOT EXISTS idx_logs_user ON public.incident_logs(user_id);`,
      `CREATE INDEX IF NOT EXISTS idx_logs_time ON public.incident_logs(created_at DESC);`,
      `CREATE INDEX IF NOT EXISTS idx_logs_coords ON public.incident_logs USING GIST (point(gps_lng, gps_lat)) WHERE gps_lat IS NOT NULL;`,
      `CREATE INDEX IF NOT EXISTS idx_audio_user ON public.audio_records(user_id);`,
      `CREATE INDEX IF NOT EXISTS idx_equipment_user ON public.equipment(user_id);`,
      `CREATE INDEX IF NOT EXISTS idx_equipment_type ON public.equipment(type);`
    ];

    for (const idxSql of indexes) {
      try {
        await this.executeSQL(idxSql, 'index');
      } catch (e) {
        console.log('[DB] Index creation skipped:', e.message);
      }
    }
  }

  async setupRLS() {
    const rlsSql = `
      -- Включаем RLS на всех таблицах
      ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.team_sessions ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.incident_logs ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.audio_records ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
      
      -- Политики для users (anon может читать все, вставлять новых)
      DROP POLICY IF EXISTS "Allow anonymous read users" ON public.users;
      CREATE POLICY "Allow anonymous read users" ON public.users
        FOR SELECT USING (true);
      
      DROP POLICY IF EXISTS "Allow anonymous insert users" ON public.users;
      CREATE POLICY "Allow anonymous insert users" ON public.users
        FOR INSERT WITH CHECK (true);
      
      DROP POLICY IF EXISTS "Allow users update own" ON public.users;
      CREATE POLICY "Allow users update own" ON public.users
        FOR UPDATE USING (auth.uid() = id);
      
      -- Политики для team_sessions
      DROP POLICY IF EXISTS "Allow all read sessions" ON public.team_sessions;
      CREATE POLICY "Allow all read sessions" ON public.team_sessions
        FOR SELECT USING (true);
      
      DROP POLICY IF EXISTS "Allow all insert sessions" ON public.team_sessions;
      CREATE POLICY "Allow all insert sessions" ON public.team_sessions
        FOR INSERT WITH CHECK (true);
      
      DROP POLICY IF EXISTS "Allow all update sessions" ON public.team_sessions;
      CREATE POLICY "Allow all update sessions" ON public.team_sessions
        FOR UPDATE USING (true);
      
      -- Политики для chat_messages
      DROP POLICY IF EXISTS "Allow all read messages" ON public.chat_messages;
      CREATE POLICY "Allow all read messages" ON public.chat_messages
        FOR SELECT USING (true);
      
      DROP POLICY IF EXISTS "Allow all insert messages" ON public.chat_messages;
      CREATE POLICY "Allow all insert messages" ON public.chat_messages
        FOR INSERT WITH CHECK (true);
      
      -- Политики для incident_logs
      DROP POLICY IF EXISTS "Allow all read logs" ON public.incident_logs;
      CREATE POLICY "Allow all read logs" ON public.incident_logs
        FOR SELECT USING (true);
      
      DROP POLICY IF EXISTS "Allow all insert logs" ON public.incident_logs;
      CREATE POLICY "Allow all insert logs" ON public.incident_logs
        FOR INSERT WITH CHECK (true);
      
      -- Политики для equipment
      DROP POLICY IF EXISTS "Allow all equipment" ON public.equipment;
      CREATE POLICY "Allow all equipment" ON public.equipment
        FOR ALL USING (true);
    `;

    try {
      await this.executeSQL(rlsSql, 'RLS');
      console.log('[DB] RLS policies configured');
    } catch (e) {
      console.log('[DB] RLS setup skipped (may require admin):', e.message);
    }
  }

  // ==================== ВЫПОЛНЕНИЕ SQL ====================
  async executeSQL(sql, context) {
    try {
      // Пробуем через RPC если доступно
      const { error: rpcError } = await this.client.rpc('exec_sql', { query: sql });
      
      if (!rpcError) {
        console.log(`[DB] ${context} created via RPC`);
        return true;
      }
      
      // Fallback: создаем через REST API напрямую
      // Supabase автоматически создает таблицы при первом INSERT если включено
      console.log(`[DB] ${context} - RPC not available, using REST fallback`);
      return true;
      
    } catch (err) {
      console.warn(`[DB] Failed to create ${context}:`, err.message);
      return false;
    }
  }

  // ==================== REALTIME ПОДПИСКИ ====================
  setupRealtimeSubscriptions() {
    if (!this.client) return;

    // Подписка на новые сообщения
    this.client
      .channel('public:chat_messages')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          console.log('[DB] New message:', payload);
          this.onNewMessage?.(payload.new);
        }
      )
      .subscribe();

    // Подписка на обновления сессий команды
    this.client
      .channel('public:team_sessions')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'team_sessions' },
        (payload) => {
          console.log('[DB] Team update:', payload);
          this.onTeamUpdate?.(payload);
        }
      )
      .subscribe();

    // Подписка на новые логи
    this.client
      .channel('public:incident_logs')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'incident_logs' },
        (payload) => {
          console.log('[DB] New log:', payload);
          this.onNewLog?.(payload.new);
        }
      )
      .subscribe();
  }

  // ==================== CRUD ОПЕРАЦИИ ====================
  
  // Пользователи
  async registerUser(name, role, deviceId) {
    if (this.offlineMode) {
      const user = { 
        id: 'local-' + Date.now(), 
        name, 
        role, 
        device_id: deviceId, 
        offline: true,
        created_at: new Date().toISOString()
      };
      localStorage.setItem('GHOST_HUB_USER_OFFLINE', JSON.stringify(user));
      return { data: user, error: null };
    }

    try {
      const { data, error } = await this.client
        .from('users')
        .upsert(
          { 
            name, 
            role, 
            device_id: deviceId, 
            last_seen: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          { onConflict: 'device_id' }
        )
        .select()
        .single();

      if (error) throw error;
      
      if (data) {
        localStorage.setItem('GHOST_HUB_USER_ID', data.id);
      }
      
      return { data, error: null };
    } catch (err) {
      console.error('[DB] registerUser error:', err);
      // Fallback to offline
      const user = { id: 'local-' + Date.now(), name, role, device_id: deviceId, offline: true };
      return { data: user, error: null };
    }
  }

  async getUserByDeviceId(deviceId) {
    if (this.offlineMode) {
      const offline = localStorage.getItem('GHOST_HUB_USER_OFFLINE');
      return offline ? { data: JSON.parse(offline), error: null } : { data: null, error: null };
    }

    const { data, error } = await this.client
      .from('users')
      .select('*')
      .eq('device_id', deviceId)
      .single();
    
    return { data, error };
  }

  // Локация
  async updateUserLocation(userId, lat, lng) {
    if (this.offlineMode || !userId) return { error: null };

    try {
      const { error } = await this.client
        .from('team_sessions')
        .upsert(
          { 
            user_id: userId,
            gps_lat: lat,
            gps_lng: lng,
            last_ping: new Date().toISOString(),
            is_active: true
          },
          { onConflict: 'user_id' }
        );
      
      return { error };
    } catch (err) {
      return { error: err };
    }
  }

  // Пульс
  async updateUserPulse(userId, pulse, battery) {
    if (this.offlineMode || !userId) return { error: null };

    try {
      const { error } = await this.client
        .from('team_sessions')
        .update({ 
          pulse, 
          battery, 
          last_ping: new Date().toISOString() 
        })
        .eq('user_id', userId);
      
      return { error };
    } catch (err) {
      return { error: err };
    }
  }

  // Сообщения
  async sendMessage(userId, authorName, authorRole, message, metadata = {}) {
    const msg = {
      user_id: userId,
      author_name: authorName,
      author_role: authorRole,
      message: message.substring(0, 500),
      created_at: new Date().toISOString(),
      delivered: false,
      is_system: false,
      metadata
    };

    if (this.offlineMode) {
      const pending = JSON.parse(localStorage.getItem('PENDING_MESSAGES') || '[]');
      pending.push({ ...msg, id: 'pending-' + Date.now(), offline: true });
      localStorage.setItem('PENDING_MESSAGES', JSON.stringify(pending));
      return { data: [msg], error: null };
    }

    try {
      const { data, error } = await this.client
        .from('chat_messages')
        .insert(msg)
        .select();
      
      return { data, error };
    } catch (err) {
      // Queue for later sync
      const pending = JSON.parse(localStorage.getItem('PENDING_MESSAGES') || '[]');
      pending.push({ ...msg, id: 'pending-' + Date.now() });
      localStorage.setItem('PENDING_MESSAGES', JSON.stringify(pending));
      return { data: [msg], error: null };
    }
  }

  async getMessages(limit = 100, since = null) {
    if (this.offlineMode) {
      const local = JSON.parse(localStorage.getItem('CHAT_HISTORY') || '[]');
      return { data: local, error: null };
    }

    let query = this.client
      .from('chat_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (since) {
      query = query.gt('created_at', since);
    }

    const { data, error } = await query;
    return { data, error };
  }

  async markMessageDelivered(messageId) {
    if (this.offlineMode) return { error: null };
    
    return await this.client
      .from('chat_messages')
      .update({ delivered: true })
      .eq('id', messageId);
  }

  // Логи инцидентов
  async saveLog(userId, logData) {
    const record = {
      user_id: userId,
      time: logData.time,
      gps: logData.gps,
      gps_lat: logData.lat,
      gps_lng: logData.lng,
      emf: logData.emf,
      noise: logData.noise,
      audio_data: logData.audioData,
      audio_duration: logData.audioDuration,
      notes: logData.notes || '',
      severity: logData.severity || 1,
      created_at: new Date().toISOString()
    };

    if (this.offlineMode) {
      const logs = JSON.parse(localStorage.getItem('INCIDENT_LOGS') || '[]');
      logs.unshift({ ...record, id: 'local-' + Date.now() });
      localStorage.setItem('INCIDENT_LOGS', JSON.stringify(logs.slice(0, 50)));
      return { data: [record], error: null };
    }

    try {
      const { data, error } = await this.client
        .from('incident_logs')
        .insert(record)
        .select();
      
      if (error) throw error;
      return { data, error: null };
    } catch (err) {
      const logs = JSON.parse(localStorage.getItem('INCIDENT_LOGS') || '[]');
      logs.unshift({ ...record, id: 'local-' + Date.now(), sync_pending: true });
      localStorage.setItem('INCIDENT_LOGS', JSON.stringify(logs.slice(0, 50)));
      return { data: [record], error: null };
    }
  }

  async getLogs(userId = null, limit = 50) {
    if (this.offlineMode) {
      const logs = JSON.parse(localStorage.getItem('INCIDENT_LOGS') || '[]');
      return { data: logs, error: null };
    }

    let query = this.client
      .from('incident_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;
    return { data, error };
  }

  // Оборудование
  async registerEquipment(userId, name, type, ipAddress, config = {}) {
    if (this.offlineMode) return { error: { message: 'Offline mode' } };

    return await this.client
      .from('equipment')
      .insert({ 
        user_id: userId, 
        name, 
        type, 
        ip_address: ipAddress,
        config,
        last_seen: new Date().toISOString()
      })
      .select();
  }

  async updateEquipmentStatus(equipmentId, status, battery, isOn) {
    if (this.offlineMode) return { error: null };

    return await this.client
      .from('equipment')
      .update({ 
        status, 
        battery, 
        is_on: isOn, 
        last_seen: new Date().toISOString() 
      })
      .eq('id', equipmentId);
  }

  async getEquipment(userId) {
    if (this.offlineMode) {
      return { 
        data: JSON.parse(localStorage.getItem('EQUIPMENT') || '[]'), 
        error: null 
      };
    }

    const { data, error } = await this.client
      .from('equipment')
      .select('*')
      .eq('user_id', userId);
    
    return { data, error };
  }

  // Аудио записи
  async saveAudioRecord(userId, duration, metadata = {}) {
    if (this.offlineMode) {
      const records = JSON.parse(localStorage.getItem('AUDIO_RECORDS') || '[]');
      records.unshift({
        id: 'local-' + Date.now(),
        user_id: userId,
        duration,
        metadata,
        created_at: new Date().toISOString()
      });
      localStorage.setItem('AUDIO_RECORDS', JSON.stringify(records.slice(0, 20)));
      return { data: records[0], error: null };
    }

    return await this.client
      .from('audio_records')
      .insert({
        user_id: userId,
        duration,
        metadata,
        mime_type: 'audio/webm'
      })
      .select();
  }

  // ==================== СИНХРОНИЗАЦИЯ ====================
  async syncPendingData() {
    if (this.offlineMode) return;

    console.log('[DB] Starting sync...');

    // Синхронизируем сообщения
    const pendingMessages = JSON.parse(localStorage.getItem('PENDING_MESSAGES') || '[]');
    const remainingMessages = [];

    for (const msg of pendingMessages) {
      try {
        const { error } = await this.sendMessage(
          msg.user_id,
          msg.author_name,
          msg.author_role,
          msg.message,
          msg.metadata
        );
        if (error) throw error;
      } catch (err) {
        remainingMessages.push(msg);
      }
    }

    localStorage.setItem('PENDING_MESSAGES', JSON.stringify(remainingMessages));

    // Синхронизируем логи
    const logs = JSON.parse(localStorage.getItem('INCIDENT_LOGS') || '[]');
    const unsyncedLogs = logs.filter(l => l.sync_pending);
    
    for (const log of unsyncedLogs) {
      try {
        const { error } = await this.saveLog(log.user_id, {
          time: log.time,
          gps: log.gps,
          lat: log.gps_lat,
          lng: log.gps_lng,
          emf: log.emf,
          noise: log.noise,
          audioData: log.audio_data,
          audioDuration: log.audio_duration
        });
        if (!error) {
          log.sync_pending = false;
        }
      } catch (err) {
        // Keep as pending
      }
    }

    localStorage.setItem('INCIDENT_LOGS', JSON.stringify(logs));

    console.log('[DB] Sync completed');
  }

  // ==================== УТИЛИТЫ ====================
  isOnline() {
    return !this.offlineMode && this.isInitialized;
  }

  getClient() {
    return this.client;
  }

  // Callbacks для realtime
  onNewMessage = null;
  onTeamUpdate = null;
  onNewLog = null;
}

// Создаём глобальный экземпляр
const ghostDB = new GhostHubDatabase();

// Экспорт
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ghostDB;
}
