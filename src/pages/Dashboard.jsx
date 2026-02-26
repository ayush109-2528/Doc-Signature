import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { motion, AnimatePresence } from 'framer-motion' // <--- Animation Lib
import { 
  Upload, FileText, LogOut, Loader2, Plus, 
  Search, Clock, Trash2, Download, History, X,
  ChevronRight, MoreHorizontal
} from 'lucide-react'

export default function Dashboard() {
  const [docs, setDocs] = useState([])
  const [uploading, setUploading] = useState(false)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  
  // Audit Log State
  const [auditLogs, setAuditLogs] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [selectedDocTitle, setSelectedDocTitle] = useState("")

  const navigate = useNavigate()
  const uploadLock = useRef(false)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return navigate('/auth')
      setUser(user)
      await fetchDocs(user.id)
      setLoading(false)
    }
    init()
  }, [navigate])

  const fetchDocs = async (userId) => {
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false })
    setDocs(data || [])
  }

  const handleUpload = async (e) => {
    if (uploadLock.current) return
    uploadLock.current = true
    setUploading(true)

    try {
      const file = e.target.files?.[0]
      if (!file) return

      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `${user.id}/${fileName}`

      await supabase.storage.from('documents').upload(filePath, file)
      
      const { data: doc } = await supabase
        .from('documents')
        .insert([{ owner_id: user.id, title: file.name, status: 'draft' }])
        .select().single()

      await supabase.from('document_versions').insert([{
        document_id: doc.id,
        version_number: 1,
        file_path: filePath,
        created_by: user.id
      }])

      await fetchDocs(user.id)
    } catch (err) {
      alert(err.message)
    } finally {
      uploadLock.current = false
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleDownload = async (e, doc) => {
    e.stopPropagation()
    const { data: version } = await supabase.from('document_versions').select('file_path').eq('document_id', doc.id).order('version_number', { ascending: false }).limit(1).single()
    const { data } = await supabase.storage.from('documents').createSignedUrl(version.file_path, 60)
    window.open(data.signedUrl, '_blank')
  }

  const handleDelete = async (e, docId) => {
    e.stopPropagation()
    if (!confirm("Are you sure?")) return
    await supabase.from('documents').delete().eq('id', docId)
    setDocs(docs.filter(d => d.id !== docId))
  }

  const handleHistory = async (e, doc) => {
    e.stopPropagation()
    setSelectedDocTitle(doc.title)
    setShowHistory(true)
    setAuditLogs([])
    const { data } = await supabase.from('audit_logs').select('*').eq('document_id', doc.id).order('created_at', { ascending: false })
    setAuditLogs(data || [])
  }

  if (loading) return (
    <div className="h-screen w-full flex items-center justify-center bg-slate-50">
      <Loader2 className="animate-spin text-blue-600" size={32} />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900 pb-20">
      
      {/* --- 1. GLASS NAVBAR --- */}
      <nav className="sticky top-0 z-30 bg-white/70 backdrop-blur-xl border-b border-slate-200/60 px-6 py-4 transition-all">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-blue-600 to-indigo-500 p-2.5 rounded-xl shadow-lg shadow-blue-500/20">
              <FileText className="text-white w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600">
              DocSigner
            </span>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-100/80 px-3 py-1.5 rounded-full border border-slate-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></span>
              {user?.email}
            </div>
            <button onClick={() => supabase.auth.signOut()} className="text-slate-400 hover:text-red-500 transition-colors">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </nav>

      {/* --- 2. HERO SECTION --- */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12"
        >
          <div>
            <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">Documents</h1>
            <p className="text-slate-500 text-lg">Manage and track your contracts in real-time.</p>
          </div>
          
          <motion.label 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`
              relative group overflow-hidden bg-slate-900 hover:bg-slate-800 text-white 
              px-6 py-3.5 rounded-xl cursor-pointer shadow-xl shadow-slate-900/20 transition-all
              ${uploading ? 'opacity-70 pointer-events-none' : ''}
            `}
          >
            <div className="flex items-center gap-2 relative z-10">
              {uploading ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
              <span className="font-semibold">{uploading ? 'Uploading...' : 'New Document'}</span>
            </div>
            {/* Shimmer Effect */}
            <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent z-0"></div>
            <input type="file" className="hidden" accept="application/pdf" onChange={handleUpload} disabled={uploading} />
          </motion.label>
        </motion.div>

        {/* --- 3. DOCUMENTS GRID --- */}
        {docs.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border-2 border-dashed border-slate-200"
          >
            <div className="bg-blue-50 p-4 rounded-full mb-4">
              <Upload className="text-blue-500 w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-800">No documents yet</h3>
            <p className="text-slate-500 mt-2">Upload your first PDF to get started.</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {docs.map((doc, index) => (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => navigate(`/document/${doc.id}`)}
                  className="group bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-blue-900/5 hover:-translate-y-1 transition-all duration-300 cursor-pointer relative overflow-hidden"
                >
                  {/* Card Status Bar */}
                  <div className={`absolute top-0 left-0 w-full h-1 ${doc.status === 'completed' ? 'bg-emerald-500' : 'bg-blue-500'}`} />

                  <div className="flex justify-between items-start mb-6">
                    <div className={`
                      p-3 rounded-xl transition-colors
                      ${doc.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}
                    `}>
                      <FileText size={24} />
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0 duration-200">
                      <IconButton icon={History} onClick={(e) => handleHistory(e, doc)} color="text-purple-500 hover:bg-purple-50" />
                      {doc.status === 'completed' && (
                        <IconButton icon={Download} onClick={(e) => handleDownload(e, doc)} color="text-blue-500 hover:bg-blue-50" />
                      )}
                      <IconButton icon={Trash2} onClick={(e) => handleDelete(e, doc.id)} color="text-red-500 hover:bg-red-50" />
                    </div>
                  </div>

                  <h3 className="font-bold text-lg text-slate-800 truncate mb-1">{doc.title}</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-6 font-medium">
                    <Clock size={12} />
                    {new Date(doc.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                    <StatusBadge status={doc.status} />
                    <span className="flex items-center gap-1 text-xs font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                      {doc.status === 'completed' ? 'View Signed' : 'Sign Now'} <ChevronRight size={14} />
                    </span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* --- 4. ANIMATED AUDIT MODAL --- */}
      <AnimatePresence>
        {showHistory && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            onClick={() => setShowHistory(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100"
            >
              <div className="bg-slate-50/50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-slate-800">Audit Trail</h3>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium">Immutable Record</p>
                </div>
                <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X size={18} className="text-slate-400" />
                </button>
              </div>

              <div className="max-h-[400px] overflow-y-auto p-2">
                {auditLogs.length === 0 ? (
                  <div className="p-10 text-center text-slate-400 text-sm">Loading blockchain records...</div>
                ) : (
                  <div className="relative pl-4 py-2">
                     {/* Timeline Line */}
                    <div className="absolute left-6 top-4 bottom-4 w-px bg-slate-100"></div>
                    
                    {auditLogs.map((log, i) => (
                      <motion.div 
                        key={log.id} 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="relative pl-8 pr-4 py-3 hover:bg-slate-50 rounded-lg transition-colors group"
                      >
                        <div className={`absolute left-[5px] top-5 w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm z-10 
                          ${log.action === 'CREATED' ? 'bg-blue-500' : 'bg-emerald-500'}
                        `}></div>
                        
                        <div className="flex justify-between items-start">
                          <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">{log.action}</span>
                          <span className="text-[10px] font-mono text-slate-400">{new Date(log.created_at).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-sm text-slate-600 mt-1">{log.details}</p>
                        <p className="text-[10px] text-slate-400 mt-1 font-medium">{new Date(log.created_at).toLocaleDateString()}</p>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// --- SUB COMPONENTS ---

function IconButton({ icon: Icon, onClick, color }) {
  return (
    <button 
      onClick={onClick}
      className={`p-2 rounded-full transition-all duration-200 hover:scale-110 ${color}`}
    >
      <Icon size={18} />
    </button>
  )
}

function StatusBadge({ status }) {
  const styles = {
    draft: "bg-slate-100 text-slate-600 ring-slate-200",
    completed: "bg-emerald-50 text-emerald-600 ring-emerald-200",
    rejected: "bg-red-50 text-red-600 ring-red-200"
  }
  
  const labels = {
    draft: "Draft",
    completed: "Signed & Verified",
    rejected: "Rejected"
  }

  return (
    <span className={`
      px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset
      ${styles[status] || styles.draft}
    `}>
      {labels[status] || status}
    </span>
  )
}