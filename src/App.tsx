import React, { useState, useEffect } from 'react';
import { Lock, Plus, Download, Upload, Search, Copy, Eye, EyeOff, Shield, Database, Key, Trash2, Edit, Pin, Tags } from 'lucide-react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { projectsDB, secretsDB } from './lib/db';
import { encrypt, decrypt } from './lib/crypto';
import type { Project, Secret, Theme } from './types';
import clsx from 'clsx';

function App() {
  const [isLocked, setIsLocked] = useState(true);
  const [showLanding, setShowLanding] = useState(true);
  const [passphrase, setPassphrase] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [deletedSecrets, setDeletedSecrets] = useState<Secret[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [globalSearch, setGlobalSearch] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [projectTags, setProjectTags] = useState<string[]>([]);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newSecret, setNewSecret] = useState({ title: '', content: '', category: 'password' });
  const [editingSecret, setEditingSecret] = useState<Secret | null>(null);
  const [showSecretContent, setShowSecretContent] = useState<Record<string, boolean>>({});
  const [copyStatus, setCopyStatus] = useState<Record<string, boolean>>({});
  const [theme, setTheme] = useState<Theme>('light');
  const [showTrash, setShowTrash] = useState(false);

  // Parallax effect
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useTransform(mouseY, [-300, 300], [10, -10]);
  const rotateY = useTransform(mouseX, [-300, 300], [-10, 10]);

  useEffect(() => {
    if (!isLocked) {
      loadProjects();
      loadDeletedSecrets();
    }
  }, [isLocked]);

  useEffect(() => {
    if (selectedProject) {
      loadSecrets(selectedProject.id);
    }
  }, [selectedProject]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Auto-lock after 30 minutes of inactivity
  useEffect(() => {
    let timeout: number;
    const resetTimeout = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        setIsLocked(true);
        setShowLanding(true);
        setPassphrase('');
      }, 30 * 60 * 1000);
    };

    window.addEventListener('mousemove', resetTimeout);
    window.addEventListener('keypress', resetTimeout);
    resetTimeout();

    return () => {
      window.removeEventListener('mousemove', resetTimeout);
      window.removeEventListener('keypress', resetTimeout);
      clearTimeout(timeout);
    };
  }, []);

  const loadProjects = async () => {
    const loadedProjects = await projectsDB.getAll();
    setProjects(loadedProjects);
  };

  const loadSecrets = async (projectId: string) => {
    const loadedSecrets = await secretsDB.getAllByProject(projectId);
    setSecrets(loadedSecrets);
  };

  const loadDeletedSecrets = async () => {
    const deleted = await secretsDB.getDeleted();
    setDeletedSecrets(deleted);
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passphrase.length >= 8) {
      setIsLocked(false);
      setShowLanding(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newProjectName.trim()) {
      const project: Project = {
        id: crypto.randomUUID(),
        name: newProjectName,
        tags: projectTags,
        isPinned: false,
        createdAt: Date.now(),
      };
      await projectsDB.add(project);
      setNewProjectName('');
      setProjectTags([]);
      setShowNewProject(false);
      loadProjects();
    }
  };

  const handleTogglePin = async (projectId: string) => {
    await projectsDB.togglePin(projectId);
    loadProjects();
  };

  const handleUpdateTags = async (projectId: string, tags: string[]) => {
    await projectsDB.updateTags(projectId, tags);
    loadProjects();
  };

  const handleCreateSecret = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedProject && newSecret.title && newSecret.content) {
      const secret: Secret = {
        id: crypto.randomUUID(),
        projectId: selectedProject.id,
        title: newSecret.title,
        content: encrypt(newSecret.content, passphrase).content,
        category: newSecret.category,
        isDeleted: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await secretsDB.add(secret);
      setNewSecret({ title: '', content: '', category: 'password' });
      loadSecrets(selectedProject.id);
    }
  };

  const handleUpdateSecret = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSecret && selectedProject) {
      const updated = {
        ...editingSecret,
        title: newSecret.title,
        content: encrypt(newSecret.content, passphrase).content,
        category: newSecret.category,
        updatedAt: Date.now(),
      };
      await secretsDB.update(updated);
      setEditingSecret(null);
      setNewSecret({ title: '', content: '', category: 'password' });
      loadSecrets(selectedProject.id);
    }
  };

  const handleDeleteSecret = async (secretId: string) => {
    await secretsDB.delete(secretId);
    loadSecrets(selectedProject!.id);
    loadDeletedSecrets();
  };

  const handleRestoreSecret = async (secretId: string) => {
    await secretsDB.restore(secretId);
    loadDeletedSecrets();
    if (selectedProject) {
      loadSecrets(selectedProject.id);
    }
  };

  const handlePermanentDelete = async (secretId: string) => {
    await secretsDB.permanentDelete(secretId);
    loadDeletedSecrets();
  };

  const handleCopySecret = async (secret: Secret) => {
    try {
      const decrypted = decrypt({ iv: '', content: secret.content }, passphrase);
      const textArea = document.createElement('textarea');
      textArea.value = decrypted;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);

      setCopyStatus({ ...copyStatus, [secret.id]: true });
      setTimeout(() => {
        setCopyStatus({ ...copyStatus, [secret.id]: false });
      }, 2000);

      setTimeout(() => {
        const clearArea = document.createElement('textarea');
        clearArea.value = '';
        document.body.appendChild(clearArea);
        clearArea.select();
        document.execCommand('copy');
        document.body.removeChild(clearArea);
      }, 5000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleExport = () => {
    const data = {
      projects,
      secrets,
      timestamp: Date.now(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `secrets-backup-${new Date().toISOString().split('T')[0]}.env`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const text = await file.text();
      const data = JSON.parse(text);
      for (const project of data.projects) {
        await projectsDB.add(project);
      }
      for (const secret of data.secrets) {
        await secretsDB.add(secret);
      }
      loadProjects();
      if (selectedProject) {
        loadSecrets(selectedProject.id);
      }
    }
  };

  if (showLanding) {
    return (
      <motion.div
        className="min-h-screen bg-yellow-50 flex flex-col items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="w-full max-w-4xl relative">
          {/* Beta tag */}
          <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold">
            Currently in Beta
          </div>

          <motion.div
            className="neo-card p-8 mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <motion.div
              className="text-center mb-12 parallax-element"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Lock className="w-16 h-16 mx-auto mb-4" />
              <h1 className="text-4xl font-black mb-4">TERCES SECRETS MANAGER</h1>
              <p className="text-xl font-bold mb-8">Your secrets, your control, 100% private</p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
              <motion.div
                className="text-center"
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <Shield className="w-12 h-12 mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">100% Private</h3>
                <p>All data stays in your browser. Nothing ever leaves your device.</p>
              </motion.div>
              <motion.div
                className="text-center"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                <Key className="w-12 h-12 mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">End-to-End Encryption</h3>
                <p>AES-256 encryption protects your secrets with your passphrase.</p>
              </motion.div>
              <motion.div
                className="text-center"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.8 }}
              >
                <Database className="w-12 h-12 mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">Local Storage</h3>
                <p>Uses your browser's IndexedDB for secure, offline storage.</p>
              </motion.div>
            </div>

            <div className="neo-card p-8 bg-white">
              <h2 className="text-2xl font-bold mb-4">How It Works</h2>
              <ol className="space-y-4 mb-8">
                <li className="flex items-start">
                  <span className="neo-button w-8 h-8 flex items-center justify-center mr-4 bg-blue-300">1</span>
                  <p>Enter a strong passphrase (min. 8 characters) to encrypt your secrets</p>
                </li>
                <li className="flex items-start">
                  <span className="neo-button w-8 h-8 flex items-center justify-center mr-4 bg-green-300">2</span>
                  <p>Create projects to organize your secrets (e.g., "Work", "Personal")</p>
                </li>
                <li className="flex items-start">
                  <span className="neo-button w-8 h-8 flex items-center justify-center mr-4 bg-yellow-300">3</span>
                  <p>Add secrets like passwords, API keys, or notes to your projects</p>
                </li>
                <li className="flex items-start">
                  <span className="neo-button w-8 h-8 flex items-center justify-center mr-4 bg-purple-300">4</span>
                  <p>Export/import your encrypted data for backup or transfer</p>
                </li>
              </ol>

              <form onSubmit={handleUnlock} className="max-w-md mx-auto">
                <input
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  className="neo-input w-full px-4 py-2 mb-4"
                  placeholder="Enter passphrase (min. 8 characters)"
                  minLength={8}
                  required
                />
                <button type="submit" className="neo-button w-full px-4 py-2 bg-green-300">
                  GET STARTED
                </button>
              </form>
            </div>

            {/* Added strong passphrase note */}
            <div className="mt-6 text-center text-sm text-gray-600">
              <p>Use a strong, unique passphrase that you won't forget. We cannot recover your data if you lose your passphrase.</p>
            </div>
          </motion.div>
        </div>
      </motion.div>
    );
  }

  if (isLocked) {
    return (
      <div className="min-h-screen bg-yellow-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="neo-card p-8 mb-8">
            <div className="text-center mb-8">
              <Lock className="w-12 h-12 mx-auto mb-4" />
              <h1 className="text-2xl font-black">SECRETS MANAGER</h1>
              <p className="mt-2 font-bold">Enter your passphrase to unlock</p>
            </div>
            <form onSubmit={handleUnlock} className="space-y-4">
              <input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                className="neo-input w-full px-4 py-2"
                placeholder="Enter passphrase"
                minLength={8}
                required
              />
              <button type="submit" className="neo-button w-full px-4 py-2 bg-green-300">
                UNLOCK
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const filteredSecrets = secrets.filter(secret =>
    secret.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-yellow-50 flex">
      <div className="neo-sidebar w-72 p-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-black">PROJECTS</h1>
          <button
            onClick={() => setShowNewProject(true)}
            className="neo-button p-2 bg-blue-300"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {showNewProject && (
          <form onSubmit={handleCreateProject} className="mb-4">
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              className="neo-input w-full px-3 py-2 mb-2"
              placeholder="Project name"
              required
            />
            <input
              type="text"
              value={projectTags.join(', ')}
              onChange={(e) => setProjectTags(e.target.value.split(',').map(tag => tag.trim()))}
              className="neo-input w-full px-3 py-2 mb-2"
              placeholder="Tags (comma-separated)"
            />
            <button type="submit" className="neo-button w-full px-3 py-2 bg-green-300">
              CREATE PROJECT
            </button>
          </form>
        )}

        <div className="space-y-2">
          {projects.map(project => (
            <div key={project.id} className="flex items-center gap-2">
              <button
                onClick={() => setSelectedProject(project)}
                className={clsx(
                  'neo-button flex-1 px-3 py-2 text-left',
                  selectedProject?.id === project.id ? 'bg-blue-300' : 'bg-white'
                )}
              >
                {project.name}
                {project.tags.length > 0 && (
                  <div className="text-xs mt-1">
                    {project.tags.map(tag => (
                      <span key={tag} className="mr-1 bg-gray-200 px-1 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </button>
              <button
                onClick={() => handleTogglePin(project.id)}
                className={clsx(
                  'neo-button p-2',
                  project.isPinned ? 'bg-yellow-300' : 'bg-white'
                )}
              >
                <Pin className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-8 space-y-2">
          <button onClick={handleExport} className="neo-button w-full px-3 py-2 bg-purple-300">
            <Download className="w-4 h-4 inline-block mr-2" />
            Export
          </button>
          <label className="neo-button w-full px-3 py-2 bg-purple-300 block text-center cursor-pointer">
            <Upload className="w-4 h-4 inline-block mr-2" />
            Import
            <input
              type="file"
              onChange={handleImport}
              accept=".env"
              className="hidden"
            />
          </label>
          <button
            onClick={() => setShowTrash(!showTrash)}
            className={clsx(
              'neo-button w-full px-3 py-2',
              showTrash ? 'bg-red-300' : 'bg-white'
            )}
          >
            <Trash2 className="w-4 h-4 inline-block mr-2" />
            Trash Bin
          </button>
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="neo-button w-full px-3 py-2 bg-gray-300"
          >
            {theme === 'light' ? '🌙 Dark' : '☀️ Light'} Theme
          </button>
        </div>
      </div>

      <div className="flex-1 p-8">
        <div className="max-w-4xl mx-auto">
          {showTrash ? (
            <div>
              <h2 className="text-2xl font-black mb-4">Trash Bin</h2>
              <div className="space-y-4">
                {deletedSecrets.map(secret => (
                  <div key={secret.id} className="neo-card p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold">{secret.title}</h3>
                        <span className="text-sm bg-gray-200 px-2 py-1 rounded">
                          {secret.category}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRestoreSecret(secret.id)}
                          className="neo-button p-2 bg-green-300"
                        >
                          Restore
                        </button>
                        <button
                          onClick={() => handlePermanentDelete(secret.id)}
                          className="neo-button p-2 bg-red-300"
                        >
                          Delete Forever
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : selectedProject ? (
            <>
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-black">{selectedProject.name}</h2>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="neo-input px-3 py-2"
                      placeholder="Search secrets..."
                    />
                  </div>
                </div>

                <form onSubmit={editingSecret ? handleUpdateSecret : handleCreateSecret} className="neo-card p-4 mb-6">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <input
                      type="text"
                      value={newSecret.title}
                      onChange={(e) => setNewSecret({ ...newSecret, title: e.target.value })}
                      className="neo-input px-3 py-2"
                      placeholder="Secret title"
                      required
                    />
                    <select
                      value={newSecret.category}
                      onChange={(e) => setNewSecret({ ...newSecret, category: e.target.value })}
                      className="neo-input px-3 py-2"
                    >
                      <option value="password">Password</option>
                      <option value="api_key">API Key</option>
                      <option value="note">Note</option>
                    </select>
                  </div>
                  <textarea
                    value={newSecret.content}
                    onChange={(e) => setNewSecret({ ...newSecret, content: e.target.value })}
                    className="neo-input w-full px-3 py-2 mb-4"
                    placeholder="Secret content"
                    required
                    rows={3}
                  />
                  <button type="submit" className="neo-button px-4 py-2 bg-green-300">
                    {editingSecret ? 'Update Secret' : 'Add Secret'}
                  </button>
                  {editingSecret && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSecret(null);
                        setNewSecret({ title: '', content: '', category: 'password' });
                      }}
                      className="neo-button px-4 py-2 bg-gray-300 ml-2"
                    >
                      Cancel
                    </button>
                  )}
                </form>

                <div className="space-y-4">
                  {filteredSecrets.map(secret => (
                    <div key={secret.id} className="neo-card p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h3 className="font-bold">{secret.title}</h3>
                          <span className="text-sm bg-gray-200 px-2 py-1 rounded">
                            {secret.category}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleCopySecret(secret)}
                            className={clsx(
                              "neo-button p-2",
                              copyStatus[secret.id] ? "bg-green-300" : "bg-blue-300"
                            )}
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setShowSecretContent({
                              ...showSecretContent,
                              [secret.id]: !showSecretContent[secret.id]
                            })}
                            className="neo-button p-2 bg-yellow-300"
                          >
                            {showSecretContent[secret.id] ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => {
                              setEditingSecret(secret);
                              setNewSecret({
                                title: secret.title,
                                content: decrypt({ iv: '', content: secret.content }, passphrase),
                                category: secret.category
                              });
                            }}
                            className="neo-button p-2 bg-purple-300"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteSecret(secret.id)}
                            className="neo-button p-2 bg-red-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      {showSecretContent[secret.id] && (
                        <div className="mt-2 font-mono bg-gray-100 p-2 rounded">
                          {decrypt({ iv: '', content: secret.content }, passphrase)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center">
              <h2 className="text-xl font-bold">Select a project or create a new one</h2>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;