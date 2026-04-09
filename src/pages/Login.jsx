import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff, Mail, ArrowLeft } from 'lucide-react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      setError('');
      setMessage('');
      setLoading(true);
      await login(email, password);
      navigate('/caja');
    } catch {
      setError('Credenciales incorrectas. Verifique por favor.');
    }
    setLoading(false);
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (!email) {
      setError('Ingrese su correo para restablecer la contraseña.');
      return;
    }
    try {
      setError('');
      setMessage('');
      setLoading(true);
      await sendPasswordResetEmail(auth, email);
      setMessage('Revise su bandeja de entrada (o SPAM) para restablecer la contraseña.');
      setResetMode(false);
    } catch {
      setError('Error al enviar el correo. Verifique que esté escrito correctamente.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-brand-50 flex items-center justify-center p-4 selection:bg-brand-900 selection:text-white font-sans">
      <div className="max-w-md w-full bg-white rounded-xl shadow-xl p-10 border border-brand-200 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-brand-900"></div>
        
        <div className="text-center mb-10 mt-2">
          <h1 className="text-3xl font-black text-brand-900 tracking-tight flex items-center justify-center gap-2">
            VINDEX
          </h1>
          <p className="text-brand-500 font-bold uppercase tracking-[0.2em] text-[10px] mt-1">Finance</p>
          <div className="h-px w-16 bg-brand-200 mx-auto mt-4 mb-3"></div>
          <p className="text-brand-800 font-semibold text-sm">Excelencia Jurídica</p>
          <p className="text-brand-500 font-bold text-xs italic mt-0.5">con Integridad</p>
        </div>
        
        {resetMode ? (
          <form className="space-y-4" onSubmit={handleReset}>
            {error && <div className="bg-red-50 text-red-600 text-xs font-bold p-3 rounded-lg text-center border border-red-200">{error}</div>}
            <div className="text-center">
              <p className="text-brand-700 font-bold text-sm mb-4">Recuperación de Contraseña</p>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-2">Correo Corporativo</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-brand-50 border border-brand-200 rounded-lg px-4 py-3 text-brand-900 placeholder-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-900 focus:border-brand-500 transition-all font-medium text-sm" placeholder="admin@vindex.com" />
            </div>
            <button disabled={loading} type="submit" className="w-full bg-brand-900 hover:bg-brand-800 disabled:bg-brand-300 text-white mt-4 font-bold py-3.5 rounded-lg transition-all shadow-md hover:shadow-lg uppercase tracking-widest text-[11px] flex items-center justify-center gap-2">
              <Mail size={16}/> {loading ? 'Enviando...' : 'Enviar Enlace de Recuperación'}
            </button>
            <button type="button" onClick={() => {setResetMode(false); setError(''); setMessage('');}} className="w-full text-brand-500 hover:text-brand-900 font-bold text-xs mt-2 py-2 flex items-center justify-center gap-1 transition-colors">
              <ArrowLeft size={14}/> Volver al Login
            </button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={handleLogin}>
            {error && <div className="bg-red-50 text-red-600 text-xs font-bold p-3 rounded-lg text-center border border-red-200">{error}</div>}
            {message && <div className="bg-green-50 text-green-700 text-xs font-bold p-3 rounded-lg text-center border border-green-200">{message}</div>}
            <div>
              <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-widest mb-2">Correo Corporativo</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-brand-50 border border-brand-200 rounded-lg px-4 py-3 text-brand-900 placeholder-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-900 focus:border-brand-500 transition-all font-medium text-sm" placeholder="admin@vindex.com" />
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-[10px] font-bold text-brand-500 uppercase tracking-widest">Contraseña / PIN</label>
                <button type="button" onClick={() => {setResetMode(true); setError(''); setMessage('');}} className="text-[10px] text-brand-600 hover:text-brand-900 font-bold transition-colors">¿Olvidó su clave?</button>
              </div>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-brand-50 border border-brand-200 rounded-lg pl-4 pr-10 py-3 text-brand-900 placeholder-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-900 focus:border-brand-500 transition-all font-medium text-sm" placeholder="••••••••" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-400 hover:text-brand-900 transition-colors">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button disabled={loading} type="submit" className="w-full bg-brand-900 hover:bg-brand-800 disabled:bg-brand-300 text-white mt-4 font-bold py-3.5 rounded-lg transition-all shadow-md hover:shadow-lg uppercase tracking-widest text-[11px]">
              {loading ? 'Validando...' : 'Ingresar al Ecosistema'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
