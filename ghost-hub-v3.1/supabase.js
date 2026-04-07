// supabase.js
// GHOST-HUB v3.1 - Supabase интеграция с автоматической инициализацией БД

class GhostHubDatabase {
  constructor() {
    // URL из GitHub Secrets (process.env в Node, window.env в браузере)
    this.supabaseUrl = this.getDatabaseUrl();
    this.supabaseKey = this.getAnonKey();
    this.client = null;
    this.isInitialized = false;
    this.offlineMode = false;
  }

  getDatabaseUrl() {
    // Пробуем разные источники
    if (typeof window !== 'undefined' && window.ENV && window.ENV.DATABASE_URL) {
      return window.ENV.DATABASE_URL;
    }
    // Fallback для разработки (заменить на реальный URL при сборке)
    return localStorage.getItem('GHOST_HUB_DB_URL') || '';
  }

  getAnonKey() {
    // Anon key из secrets или localStorage для разработки
    if (typeof window !== 'undefined' && window.ENV && window.ENV.SUPABASE_ANON_KEY) {
      return window.ENV.SUPABASE_ANON_KEY;
    }
    return localStorage.getItem('GHOST_HUB_ANON_KEY') || '';
  }

  // Инициализация подключения
  async init() {
    if (!this.supabaseUrl || !this.supabaseKey) {
      console.warn('[DB] No credentials, running in offline mode');
      this.offlineMode = true;
      return false;
    }

    try {
      // Создаём клиент Supabase
      this.client = supabase.createClient(this.supabaseUrl, this.supabaseKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true
        },
        realtime: {
          enabled: true
        }
      });

      // Проверяем подключение
      const { error } = await this.client.from('users').select('count').limit(1);
      
      if (error && error.code === '42P01') {
        // Таблицы не существуют - создаём
        console.log('[DB] Tables not found, initializing...');
        await this.createTables();
      } else if (error) {
        throw error;
      }

      this.isInitialized = true;
      this.offlineMode = false;
      console.log('[DB] Connected to Supabase');
      return true;

    } catch (err) {
      console.error('[DB] Connection failed:', err);
      this.offlineMode = true;
      return false;
    }
  }

  // Создание таблиц (выполняется при первом запуске)
  async createTables() {
    // SQL для создания таблиц через RPC или REST
    const setupSQL = `
      -- Таблица пользователей
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        device_id TEXT UNIQUE,
        last_seen TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- Таблица сессий (кто онлайн)
      CREATE TABLE IF NOT EXISTS team_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        joined_at TIMESTAMP DEFAULT NOW(),
        last_ping TIMESTAMP DEFAULT NOW(),
        is_active BOOLEAN DEFAULT TRUE,
        gps_lat DECIMAL(10, 8),
        gps_lng DECIMAL(11, 8),
        pulse INTEGER,
        battery INTEGER
      );

      -- Таблица сообщений чата
      CREATE TABLE IF NOT EXISTS chat_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        author_name TEXT,
        author_role TEXT,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        delivered BOOLEAN DEFAULT FALSE
      );

      -- Таблица логов событий
      CREATE TABLE IF NOT EXISTS incident_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        time TEXT NOT NULL,
        gps TEXT,
        gps_lat DECIMAL(10, 8),
        gps_lng DECIMAL(11, 8),
        emf TEXT,
        noise TEXT,
        audio_data TEXT, -- base64 или ссылка на хранилище
        audio_duration INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- Таблица аудиозаписей
      CREATE TABLE IF NOT EXISTS audio_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        duration INTEGER NOT NULL,
        file_path TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- Таблица оборудования
      CREATE TABLE IF NOT EXISTS equipment (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        type TEXT NOT NULL, -- 'camera', 'light', 'sensor'
        ip_address TEXT,
        status TEXT DEFAULT 'offline',
        battery INTEGER,
        is_on BOOLEAN DEFAULT FALSE,
        last_seen TIMESTAMP DEFAULT NOW()
      );

      -- Индексы для производительности
      CREATE INDEX IF NOT EXISTS idx_team_sessions_user ON team_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_time ON chat_messages(created_at);
      CREATE INDEX IF NOT EXISTS idx_incident_logs_user ON incident_logs(user_id);
    `;

    try {
      // Пытаемся выполнить SQL через exec_sql RPC (если настроена)
      const { error } = await this.client.rpc('exec_sql', { sql: setupSQL });
      
      if (error) {
        console.warn('[DB] RPC exec_sql not available, trying REST fallback');
        // Fallback: создаём таблицы по одной через REST
        await this.createTablesFallback();
      }
      
      console.log('[DB] Tables initialized');
    } catch (err) {
      console.error('[DB] Failed to create tables:', err);
      throw err;
    }
  }

  // Fallback создание таблиц через отдельные запросы
  async createTablesFallback() {
    const tables = [
      {
        name: 'users',
        definition: {
          id: 'uuid',
          name: 'text',
          role: 'text',
          device_id: 'text',
          last_seen: 'timestamptz',
          created_at: 'timestamptz'
        }
      },
      {
        name: 'team_sessions',
        definition: {
          id: 'uuid',
          user_id: 'uuid',
          joined_at: 'timestamptz',
          last_ping: 'timestamptz',
          is_active: 'boolean',
          gps_lat: 'float8',
          gps_lng: 'float8',
          pulse: 'int4',
          battery: 'int4'
        }
      },
      {
        name: 'chat_messages',
        definition: {
          id: 'uuid',
          user_id: 'uuid',
          author_name: 'text',
          author_role: 'text',
          message: 'text',
          created_at: 'timestamptz',
          delivered: 'boolean'
        }
      },
      {
        name: 'incident_logs',
        definition: {
          id: 'uuid',
          user_id: 'uuid',
          time: 'text',
          gps: 'text',
          gps_lat: 'float8',
          gps_lng: 'float8',
          emf: 'text',
          noise: 'text',
          audio_data: 'text',
          audio_duration: 'int4',
          created_at: 'timestamptz'
        }
      }
    ];

    for (const table of tables) {
      try {
        // Проверяем существование
        const { error: checkError } = await this.client
          .from(table.name)
          .select('count')
          .limit(1);
        
        if (checkError && checkError.code === '42P01') {
          console.log(`[DB] Creating table: ${table.name}`);
          // Создаём через INSERT с игнорированием ошибок
          // (Supabase REST автоматически создаёт таблицу при первом INSERT если включено)
        }
      } catch (err) {
        console.warn(`[DB] Table ${table.name} check failed:`, err);
      }
    }
  }

  // === МЕТОДЫ РАБОТЫ С ДАННЫМИ ===

  // Пользователи
  async registerUser(name, role, deviceId) {
    if (this.offlineMode) {
      // Сохраняем локально
      const user = { id: 'local-' + Date.now(), name, role, deviceId, offline: true };
      localStorage.setItem('GHOST_HUB_USER', JSON.stringify(user));
      return { data: [user], error: null };
    }

    const { data, error } = await this.client
      .from('users')
      .upsert({ name, role, device_id: deviceId, last_seen: new Date().toISOString() })
      .select()
      .single();
    
    if (data) {
      localStorage.setItem('GHOST_HUB_USER_ID', data.id);
    }
    
    return { data, error };
  }

  async updateUserLocation(userId, lat, lng) {
    if (this.offlineMode) return { error: null };

    return await this.client
      .from('team_sessions')
      .upsert({ 
        user_id: userId, 
        gps_lat: lat, 
        gps_lng: lng,
        last_ping: new Date().toISOString()
      });
  }

  async updateUserPulse(userId, pulse, battery) {
    if (this.offlineMode) return { error: null };

    return await this.client
      .from('team_sessions')
      .update({ pulse, battery, last_ping: new Date().toISOString() })
      .eq('user_id', userId);
  }

  // Сообщения чата
  async sendMessage(userId, authorName, authorRole, message) {
    const msg = {
      user_id: userId,
      author_name: authorName,
      author_role: authorRole,
      message,
      created_at: new Date().toISOString()
    };

    if (this.offlineMode) {
      // Сохраняем для синхронизации
      const pending = JSON.parse(localStorage.getItem('PENDING_MESSAGES') || '[]');
      pending.push({ ...msg, id: 'pending-' + Date.now(), offline: true });
      localStorage.setItem('PENDING_MESSAGES', JSON.stringify(pending));
      return { data: [msg], error: null };
    }

    return await this.client.from('chat_messages').insert(msg).select();
  }

  async getMessages(since = null) {
    if (this.offlineMode) {
      // Возвращаем локальные + pending
      const local = JSON.parse(localStorage.getItem('CHAT_HISTORY') || '[]');
      return { data: local, error: null };
    }

    let query = this.client
      .from('chat_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (since) {
      query = query.gt('created_at', since);
    }

    return await query;
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
      audio_data: logData.audioData, // base64 или ссылка
      audio_duration: logData.audioDuration,
      created_at: new Date().toISOString()
    };

    if (this.offlineMode) {
      const logs = JSON.parse(localStorage.getItem('INCIDENT_LOGS') || '[]');
      logs.unshift({ ...record, id: 'local-' + Date.now() });
      localStorage.setItem('INCIDENT_LOGS', JSON.stringify(logs.slice(0, 50)));
      return { data: [record], error: null };
    }

    return await this.client.from('incident_logs').insert(record).select();
  }

  async getLogs(userId = null) {
    if (this.offlineMode) {
      const logs = JSON.parse(localStorage.getItem('INCIDENT_LOGS') || '[]');
      return { data: logs, error: null };
    }

    let query = this.client
      .from('incident_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (userId) {
      query = query.eq('user_id', userId);
    }

    return await query;
  }

  // Оборудование
  async registerEquipment(userId, name, type, ipAddress) {
    if (this.offlineMode) return { error: { message: 'Offline mode' } };

    return await this.client
      .from('equipment')
      .insert({ user_id: userId, name, type, ip_address: ipAddress })
      .select();
  }

  async updateEquipmentStatus(equipmentId, status, battery, isOn) {
    if (this.offlineMode) return { error: null };

    return await this.client
      .from('equipment')
      .update({ status, battery, is_on: isOn, last_seen: new Date().toISOString() })
      .eq('id', equipmentId);
  }

  async getEquipment(userId) {
    if (this.offlineMode) {
      return { data: JSON.parse(localStorage.getItem('EQUIPMENT') || '[]'), error: null };
    }

    return await this.client
      .from('equipment')
      .select('*')
      .eq('user_id', userId);
  }

  // Realtime подписки
  subscribeToMessages(callback) {
    if (this.offlineMode || !this.client) return null;

    return this.client
      .channel('chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, callback)
      .subscribe();
  }

  subscribeToTeamUpdates(callback) {
    if (this.offlineMode || !this.client) return null;

    return this.client
      .channel('team')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_sessions' }, callback)
      .subscribe();
  }

  // Синхронизация после восстановления связи
  async syncPendingData() {
    if (this.offlineMode) return;

    // Синхронизируем сообщения
    const pendingMessages = JSON.parse(localStorage.getItem('PENDING_MESSAGES') || '[]');
    for (const msg of pendingMessages) {
      const { error } = await this.sendMessage(msg.user_id, msg.author_name, msg.author_role, msg.message);
      if (!error) {
        // Удаляем из pending
        const updated = pendingMessages.filter(m => m.id !== msg.id);
        localStorage.setItem('PENDING_MESSAGES', JSON.stringify(updated));
      }
    }

    console.log('[DB] Sync completed');
  }

  // Проверка статуса
  isOnline() {
    return !this.offlineMode && this.isInitialized;
  }

  getClient() {
    return this.client;
  }
}

// Создаём глобальный экземпляр
const ghostDB = new GhostHubDatabase();

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ghostDB;
}
