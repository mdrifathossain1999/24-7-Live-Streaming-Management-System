import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { 
  Lock, 
  User, 
  Radio, 
  AlertCircle, 
  UserPlus, 
  CheckCircle, 
  ArrowRight, 
  Play, 
  Pause, 
  Layers, 
  Cpu, 
  ShieldCheck, 
  ChevronDown, 
  Sparkles, 
  Database, 
  BarChart3, 
  CloudLightning, 
  Monitor, 
  Check,
  Video,
  X,
  RefreshCw,
  Mail,
  MessageSquare,
  Send,
  Zap,
  HelpCircle
} from 'lucide-react';
import { safeFetchJson } from '../utils';
import { auth } from '../firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

interface LoginProps {
  onLoginSuccess: (token: string, username: string) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  // Authentication states
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // FAQ states
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  // Interactive Live Simulator states
  const [simIsStreaming, setSimIsStreaming] = useState(true);
  const [simActiveVideo, setSimActiveVideo] = useState('Lo-Fi HipHop Radio - 24 Hours Relaxing Beats');
  const [simDestinations, setSimDestinations] = useState([
    { name: 'YouTube Live', enabled: true, connected: true },
    { name: 'Facebook Live', enabled: true, connected: true },
    { name: 'Twitch Custom', enabled: false, connected: false }
  ]);
  const [simBitrate, setSimBitrate] = useState(4850);
  const [simFps, setSimFps] = useState(60);
  const [simUptime, setSimUptime] = useState(34212); // seconds
  const [simConsoleLogs, setSimConsoleLogs] = useState<string[]>([
    'System: Core engine initialized successfully.',
    'Playlist: Lo-Fi HipHop stream selected.',
    'Encoder: 1080p60 h264 encoder ready.',
    'Drive Sync: Verified local configurations.'
  ]);

  // Audio bars animation simulation helper
  const [audioBars, setAudioBars] = useState<number[]>([40, 60, 30, 80, 50, 70, 40, 90, 60, 50]);

  // Pricing states
  const [pricingPeriod, setPricingPeriod] = useState<'monthly' | 'yearly'>('monthly');

  const handleWhatsAppOrder = (planName: string, price: string) => {
    const message = `Hello Streamer 24/7!\n\nI would like to order the following subscription:\n\n*Plan:* ${planName}\n*Price:* ${price}\n*Billing Period:* ${pricingPeriod === 'monthly' ? 'Monthly' : 'Yearly'}\n\nPlease guide me with the activation details. Thank you!`;
    const encodedText = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/8801889933520?text=${encodedText}`;
    window.open(whatsappUrl, '_blank');
  };

  // Contact States
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSending, setContactSending] = useState(false);
  const [contactSuccess, setContactSuccess] = useState('');
  const [contactError, setContactError] = useState('');

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName || !contactEmail || !contactMessage) {
      setContactError('Please fill in Name, Email and Message.');
      return;
    }
    setContactSending(true);
    setContactError('');
    setContactSuccess('');

    try {
      await new Promise(resolve => setTimeout(resolve, 1200));
      setContactSuccess('Your message has been sent successfully to the Streamer 24/7 operator support! We will reach out to you within 24 hours.');
      setContactName('');
      setContactEmail('');
      setContactSubject('');
      setContactMessage('');
    } catch (err: any) {
      setContactError('Failed to dispatch message. Please try again.');
    } finally {
      setContactSending(false);
    }
  };

  // Handle stream simulation metrics
  useEffect(() => {
    if (!simIsStreaming) return;

    const interval = setInterval(() => {
      // Randomize bitrate and fps slightly to look authentic
      setSimBitrate(prev => Math.max(4200, Math.min(5200, prev + Math.floor(Math.random() * 200) - 100)));
      setSimFps(prev => Math.max(58, Math.min(60, prev + Math.floor(Math.random() * 3) - 1)));
      setSimUptime(prev => prev + 1);

      // Audio visualizer bars simulation
      setAudioBars(prev => prev.map(() => Math.floor(Math.random() * 75) + 15));

      // Occasional log output simulation
      if (Math.random() > 0.85) {
        const logEvents = [
          'RTMP: Broadcast packets acknowledged by ingest server.',
          'Sync: Settings verified with Google Drive auto-save.',
          'Encoder: Keyframe interval aligned perfectly.',
          'Platform: RTMP target connections stable.'
        ];
        const randomLog = logEvents[Math.floor(Math.random() * logEvents.length)];
        setSimConsoleLogs(prev => [...prev.slice(-4), `[${new Date().toLocaleTimeString()}] ${randomLog}`]);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [simIsStreaming]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (isRegisterMode && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const endpoint = isRegisterMode ? '/api/auth/register' : '/api/auth/login';
      const { data, error: fetchErr } = await safeFetchJson<{ token: string; username: string }>(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (fetchErr || !data) {
        throw new Error(fetchErr || 'Authentication failed');
      }

      if (isRegisterMode) {
        setSuccess('Registration successful! Your account is pending admin approval before you can access all features.');
        setTimeout(() => {
          setIsRegisterMode(false);
          setPassword('');
          setConfirmPassword('');
          setSuccess('');
        }, 4000);
      } else {
        onLoginSuccess(data.token, data.username);
      }
    } catch (err: any) {
      setError(err.message || 'Server connection error');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/drive.file');
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      if (!user.email) {
        throw new Error('Google account must have an associated email address');
      }

      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential && credential.accessToken) {
        localStorage.setItem('google_drive_access_token', credential.accessToken);
      }
      localStorage.setItem('google_user_email', user.email);

      // Sync and authorize with local node server
      const { data, error: googleAuthErr } = await safeFetchJson<{ token: string; username: string }>('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          uid: user.uid,
          displayName: user.displayName || 'Authorized Operator'
        }),
      });

      if (googleAuthErr || !data) {
        throw new Error(googleAuthErr || 'Failed to authenticate Gmail login with local server');
      }

      setSuccess(`Welcome back, ${data.username}! Gmail authentication successful.`);
      setTimeout(() => {
        onLoginSuccess(data.token, data.username);
      }, 1200);

    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      let customError = err.message || 'Google sign-in was cancelled or failed.';
      if (err.code === 'auth/unauthorized-domain' || (err.message && err.message.includes('unauthorized-domain'))) {
        customError = `🔑 Firebase Authorized Domain Required: The domain "${window.location.hostname}" must be added to your Firebase project. To fix this, go to your Firebase Console -> Authentication -> Settings -> Authorized Domains, click "Add domain", enter "${window.location.hostname}", and click save. Then refresh and try again!`;
      } else if (err.message && (err.message.includes('405') || err.message.includes('Method Not Allowed'))) {
        customError = `❌ Proxy / Worker Blocking POST (405): Your Cloudflare Worker/Proxy "${window.location.hostname}" is blocking POST requests. The 24/7 Streamer platform requires POST requests for authentication, playlist management, and live stream actions. Please update your Cloudflare Worker script to allow and forward all HTTP methods, especially POST and OPTIONS.`;
      }
      setError(customError);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsRegisterMode(!isRegisterMode);
    setError('');
    setSuccess('');
    setPassword('');
    setConfirmPassword('');
  };

  const formatUptime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Toggle dynamic FAQ items
  const toggleFaq = (index: number) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  // Simulated Playlist Videos
  const simVideos = [
    'Lo-Fi HipHop Radio - 24 Hours Relaxing Beats',
    'Synthwave Chillout Mix - Deep Retro Night Drive',
    'Ambient Rainy Day Cafe - Smooth Coffee Shop Jazz',
    'Cyberpunk Coding Beats - High Energy Focus Mix'
  ];

  const faqs = [
    {
      q: "How does Streamer 24/7 handle uninterrupted streaming?",
      a: "The application relies on a solid background automation loop. It schedules video plays sequentially and hands over the media directly to a high-efficiency background RTMP encoder pipeline that operates even if your browser tab is completely closed."
    },
    {
      q: "Can I stream to multiple targets simultaneously?",
      a: "Absolutely! You can register multiple custom stream destinations (YouTube, Facebook, Twitch, Kick, or private RTMP URLs) and toggle which ones are actively receiving your live feed."
    },
    {
      q: "What is Google Drive Cloud Auto-Sync?",
      a: "Instead of risking setup data loss if the server container restarts, our custom Google Drive integration auto-saves your stream configurations, active stream keys, and schedules safely to your private Google Drive space. When logging in on a new container, the app auto-restores your setup."
    },
    {
      q: "Is any subscription or external payment required?",
      a: "No! Streamer 24/7 is a self-contained broadcast assistant designed to run on personal container platforms. There are no hidden fees or third-party subscription locks."
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-red-500 selection:text-white overflow-x-hidden relative">
      
      {/* Decorative Blur Ambient Elements */}
      <div className="absolute top-[-5%] left-[-5%] w-[600px] h-[600px] bg-red-600/15 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute top-[30%] right-[-10%] w-[700px] h-[700px] bg-blue-600/15 rounded-full blur-[160px] pointer-events-none"></div>
      <div className="absolute bottom-[10%] left-[10%] w-[600px] h-[600px] bg-emerald-600/10 rounded-full blur-[140px] pointer-events-none"></div>

      {/* Grid Pattern Background */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1.2px,transparent_1.2px)] [background-size:32px_32px] opacity-20 pointer-events-none"></div>

      {/* Landing Header */}
      <header className="sticky top-0 z-40 bg-slate-950/70 backdrop-blur-xl border-b border-slate-900 px-6 py-4 flex items-center justify-between transition-all">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-red-950/30 border border-red-500/20 rounded-2xl flex items-center justify-center shadow-lg shadow-red-950/40 group hover:border-red-500/45 transition-colors">
            <Radio className="w-6 h-6 text-red-500 animate-pulse" />
          </div>
          <div>
            <h1 className="text-base font-black text-white tracking-widest uppercase leading-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">Streamer 24/7</h1>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Broadcaster Engine Active</span>
            </div>
          </div>
        </div>

        {/* Navigation links (Desktop) */}
        <nav className="hidden md:flex items-center gap-8 bg-slate-900/50 border border-slate-800/40 px-6 py-2 rounded-full backdrop-blur-md">
          <a href="#features" className="text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white transition-colors">Features</a>
          <a href="#simulator" className="text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white transition-colors">Console</a>
          <a href="#sync" className="text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white transition-colors">Cloud Sync</a>
          <a href="#pricing" className="text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white transition-colors">Pricing</a>
          <a href="#faq" className="text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white transition-colors">FAQ</a>
          <a href="#contact" className="text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white transition-colors">Contact</a>
        </nav>

        {/* CTA */}
        <div>
          <button
            onClick={() => {
              setIsRegisterMode(false);
              setShowAuthModal(true);
            }}
            className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-300 cursor-pointer shadow-lg shadow-red-950/40 flex items-center gap-2 border border-red-500/20 hover:scale-102"
          >
            Launch Desk
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-24 pb-20 px-6 max-w-7xl mx-auto w-full text-center flex flex-col items-center">
        {/* Neon decorative badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-950/30 to-slate-900/40 border border-red-900/30 rounded-full text-[11px] font-extrabold text-red-400 uppercase tracking-widest mb-8 shadow-inner backdrop-blur-sm">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>Professional 24/7 RTMP Ingest Core</span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-white tracking-tight leading-none max-w-5xl">
          Broadcast Non-Stop.<br /> 
          <span className="bg-gradient-to-r from-red-500 via-orange-500 to-amber-500 bg-clip-text text-transparent filter drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)]">
            Continuous Live Automation
          </span>
        </h1>

        <p className="mt-8 text-slate-400 text-sm sm:text-base md:text-lg max-w-3xl leading-relaxed font-semibold">
          Unleash the power of autonomous live loops. Queue multiple media playlists, configure secondary destination targets, program timetables, and auto-sync configurations safely directly to your private Google Drive file block.
        </p>

        {/* Hero Actions */}
        <div className="mt-12 flex flex-col sm:flex-row items-center gap-5 w-full justify-center max-w-xl">
          <button
            onClick={() => {
              setIsRegisterMode(false);
              setShowAuthModal(true);
            }}
            className="w-full sm:w-auto px-8 py-4.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-extrabold rounded-xl transition-all duration-350 shadow-2xl shadow-red-950/40 flex items-center justify-center gap-3 cursor-pointer border border-red-500/20 text-xs uppercase tracking-wider hover:scale-102"
          >
            Access Broadcast Desk
            <ArrowRight className="w-5 h-5" />
          </button>

          <a
            href="#simulator"
            className="w-full sm:w-auto px-8 py-4.5 bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-200 hover:text-white font-extrabold rounded-xl transition-all duration-350 flex items-center justify-center gap-2.5 cursor-pointer text-xs uppercase tracking-wider hover:scale-102"
          >
            <Play className="w-4 h-4 fill-current text-red-500" />
            Explore Live Simulator
          </a>
        </div>

        {/* Quick Tech Badges */}
        <div className="mt-16 grid grid-cols-2 md:flex md:flex-wrap justify-center items-center gap-x-8 gap-y-5 text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-wider border-t border-slate-900/60 pt-10 w-full max-w-5xl">
          <div className="flex items-center justify-center gap-2">
            <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping"></span>
            <span>24/7 RTMP Core</span>
          </div>
          <div className="hidden md:block text-slate-800">|</div>
          <div className="flex items-center justify-center gap-2">
            <Check className="w-4.5 h-4.5 text-emerald-400" />
            <span>Multi-Destinations</span>
          </div>
          <div className="hidden md:block text-slate-800">|</div>
          <div className="flex items-center justify-center gap-2">
            <Check className="w-4.5 h-4.5 text-emerald-400" />
            <span>Google Drive Sync</span>
          </div>
          <div className="hidden md:block text-slate-800">|</div>
          <div className="flex items-center justify-center gap-2">
            <Check className="w-4.5 h-4.5 text-emerald-400" />
            <span>Zero Frame Drops</span>
          </div>
        </div>
      </section>

      {/* Interactive Simulator Section */}
      <section id="simulator" className="py-24 px-6 bg-slate-900/30 border-y border-slate-900/60 relative">
        <div className="max-w-7xl mx-auto w-full">
          <div className="text-center mb-16">
            <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest px-3 py-1 bg-red-950/40 border border-red-900/30 rounded-full inline-block mb-3">
              Operator Sandbox
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Interactive Broadcast Console Simulator
            </h2>
            <p className="mt-4 text-slate-400 text-sm max-w-2xl mx-auto font-medium">
              Click buttons to interact and experience how media playlists, broadcast streams, target ingestion keys, and auto-sync layers synchronize inside our background engine.
            </p>
          </div>

          {/* Simulated Console Board */}
          <div className="bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden shadow-[0_0_50px_-12px_rgba(239,68,68,0.12)] grid grid-cols-1 lg:grid-cols-12 max-w-6xl mx-auto">
            
            {/* Simulation Sidebar / Controller */}
            <div className="lg:col-span-4 p-8 border-b lg:border-b-0 lg:border-r border-slate-900 bg-slate-950/60 flex flex-col justify-between gap-8">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Simulator Controls</span>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                    simIsStreaming 
                      ? 'bg-red-950/40 text-red-400 border-red-900/30 animate-pulse' 
                      : 'bg-slate-900 text-slate-500 border-slate-800'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${simIsStreaming ? 'bg-red-500 animate-pulse' : 'bg-slate-500'}`}></span>
                    {simIsStreaming ? 'Broadcasting' : 'Paused'}
                  </span>
                </div>

                {/* Control Action buttons */}
                <div className="space-y-4">
                  <button
                    onClick={() => setSimIsStreaming(!simIsStreaming)}
                    className={`w-full py-3.5 px-4 rounded-xl font-bold text-xs uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2.5 cursor-pointer border ${
                      simIsStreaming 
                        ? 'bg-red-950/30 text-red-400 border-red-900/40 hover:bg-red-950/50' 
                        : 'bg-red-600 text-white border-red-500 hover:bg-red-500 shadow-lg shadow-red-950/30 hover:scale-102'
                    }`}
                  >
                    {simIsStreaming ? (
                      <>
                        <Pause className="w-4 h-4 fill-current" />
                        Pause Simulated Feed
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        Start Simulated Feed
                      </>
                    )}
                  </button>

                  <div className="bg-slate-900/30 p-5 border border-slate-900 rounded-2xl">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Simulate Playlist Video</p>
                    <div className="space-y-2">
                      {simVideos.map((video, idx) => {
                        const isActive = simActiveVideo === video;
                        return (
                          <button
                            key={idx}
                            onClick={() => {
                              setSimActiveVideo(video);
                              if (simIsStreaming) {
                                setSimConsoleLogs(prev => [...prev.slice(-4), `[${new Date().toLocaleTimeString()}] Selected playlist item: ${video}`]);
                              }
                            }}
                            className={`w-full text-left text-xs px-3.5 py-2.5 rounded-xl truncate font-semibold transition-all cursor-pointer border ${
                              isActive 
                                ? 'bg-red-950/30 text-red-400 border-red-500/20' 
                                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-900/60'
                            }`}
                          >
                            {video}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Targets controls */}
              <div className="border-t border-slate-900 pt-6">
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-4">Simulated Ingest Platforms</p>
                <div className="space-y-2.5">
                  {simDestinations.map((dest, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-900/20 border border-slate-900 rounded-xl">
                      <div className="flex items-center gap-2.5">
                        <Monitor className="w-4 h-4 text-slate-500" />
                        <span className="text-xs font-bold text-slate-300">{dest.name}</span>
                      </div>
                      <button
                        onClick={() => {
                          const updated = [...simDestinations];
                          updated[idx].enabled = !updated[idx].enabled;
                          if (updated[idx].enabled && simIsStreaming) {
                            updated[idx].connected = true;
                            setSimConsoleLogs(prev => [...prev.slice(-4), `[${new Date().toLocaleTimeString()}] Target ${dest.name} connected.`]);
                          } else {
                            updated[idx].connected = false;
                            setSimConsoleLogs(prev => [...prev.slice(-4), `[${new Date().toLocaleTimeString()}] Target ${dest.name} disconnected.`]);
                          }
                          setSimDestinations(updated);
                        }}
                        className={`text-[9px] font-extrabold uppercase px-3 py-1.5 rounded-lg transition-all cursor-pointer border ${
                          dest.enabled 
                            ? 'bg-emerald-950/30 text-emerald-400 border-emerald-900/40' 
                            : 'bg-slate-900 text-slate-500 border-slate-800'
                        }`}
                      >
                        {dest.enabled ? 'Streaming' : 'Disabled'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Simulated Live Feed & Metrics */}
            <div className="lg:col-span-8 p-8 flex flex-col justify-between gap-8 bg-slate-950/30">
              
              {/* Virtual Video Screen */}
              <div className="relative aspect-video bg-slate-950 rounded-2xl overflow-hidden border border-slate-900 shadow-inner flex flex-col items-center justify-center group">
                
                {/* Horizontal scanline details overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] [background-size:100%_4px,3px_100%] pointer-events-none z-10 opacity-40"></div>

                {/* Simulated playback background */}
                {simIsStreaming ? (
                  <div className="absolute inset-0 bg-slate-950/50 flex flex-col justify-between p-5 z-20">
                    {/* Top HUD overlay */}
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white font-black text-[9px] uppercase tracking-widest rounded-lg animate-pulse shadow-md shadow-red-950/50">
                        <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                        LIVE STREAM OUTPUT
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Network Bitrate</p>
                        <p className="text-xs text-emerald-400 font-mono font-bold mt-0.5">{simBitrate} kbps</p>
                      </div>
                    </div>

                    {/* Visualizer and Video Title Overlay */}
                    <div className="space-y-4">
                      <p className="text-xs text-white font-bold tracking-wide bg-slate-950/80 px-3 py-2 rounded-xl border border-slate-900 max-w-sm backdrop-blur inline-block truncate">
                        {simActiveVideo}
                      </p>

                      {/* Moving Audio Bars */}
                      <div className="flex items-end gap-1.5 h-14 bg-slate-950/60 p-2.5 rounded-xl border border-slate-900 backdrop-blur w-48">
                        {audioBars.map((val, idx) => (
                          <div 
                            key={idx} 
                            style={{ height: `${val}%` }} 
                            className="flex-1 bg-gradient-to-t from-red-600 to-orange-500 rounded-sm transition-all duration-300"
                          ></div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-8 space-y-4 z-20 relative">
                    <div className="w-14 h-14 bg-slate-950 border border-slate-850 rounded-full flex items-center justify-center mx-auto text-slate-500 shadow-lg group-hover:border-red-500/20 transition-all">
                      <Pause className="w-5 h-5 fill-current" />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">RTMP Engine Paused</p>
                      <p className="text-xs text-slate-500 max-w-xs leading-relaxed mx-auto font-medium">
                        Click 'Start Simulated Feed' above to check multi-casting metrics and live background packet loops.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Live Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-950 border border-slate-900 rounded-2xl text-center">
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Feed Resolution</p>
                  <p className="text-xs font-black text-white mt-1.5 uppercase tracking-wide">1080p FHD 60FPS</p>
                </div>
                <div className="p-4 bg-slate-950 border border-slate-900 rounded-2xl text-center">
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Active Frame Rate</p>
                  <p className="text-xs font-black text-white mt-1.5 font-mono">{simFps} fps</p>
                </div>
                <div className="p-4 bg-slate-950 border border-slate-900 rounded-2xl text-center">
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Elapsed Uptime</p>
                  <p className="text-xs font-black text-white mt-1.5 font-mono">{simIsStreaming ? formatUptime(simUptime) : '00:00:00'}</p>
                </div>
                <div className="p-4 bg-slate-950 border border-slate-900 rounded-2xl text-center">
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Active Multi-Cast</p>
                  <p className="text-xs font-black text-red-400 mt-1.5 uppercase tracking-wider">
                    {simIsStreaming ? simDestinations.filter(d => d.enabled).length : 0} / {simDestinations.length} Targets
                  </p>
                </div>
              </div>

              {/* Simulated Console Logs */}
              <div className="bg-slate-950 border border-slate-900 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Background Engine Console</span>
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                </div>
                <div className="bg-slate-950/80 p-3.5 rounded-xl font-mono text-[10px] text-slate-400 space-y-2 min-h-[96px] border border-slate-900/50">
                  {simConsoleLogs.map((log, idx) => (
                    <p key={idx} className="truncate select-none">
                      <span className="text-slate-600 mr-2.5">&gt;</span>
                      {log}
                    </p>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Grid Features Highlights Section */}
      <section id="features" className="py-28 px-6 max-w-7xl mx-auto w-full">
        <div className="text-center mb-20">
          <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest px-3 py-1 bg-red-950/40 border border-red-900/30 rounded-full inline-block mb-3">
            Core Features
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
            Designed for Flawless Broadcaster Performance
          </h2>
          <p className="mt-4 text-slate-400 text-sm sm:text-base max-w-2xl mx-auto font-medium">
            Take complete control over your live broadcasts with advanced cloud tooling, automatic timetables, and multi-endpoint delivery.
          </p>
        </div>

        {/* Features Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          
          {/* Feature 1 */}
          <div className="p-8 bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-900 rounded-3xl hover:border-red-500/20 transition-all duration-300 group shadow-lg shadow-black/50">
            <div className="w-13 h-13 bg-red-950/40 border border-red-500/15 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
              <Radio className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-base font-bold text-white tracking-wide uppercase">Multi-Destination Cast</h3>
            <p className="mt-3 text-slate-400 text-xs leading-relaxed font-semibold">
              Broadcast your streams simultaneously to YouTube, Facebook, Twitch, and custom RTMP ingest targets. Expand your audience footprint effortlessly.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="p-8 bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-900 rounded-3xl hover:border-blue-500/20 transition-all duration-300 group shadow-lg shadow-black/50">
            <div className="w-13 h-13 bg-blue-950/40 border border-blue-500/15 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
              <Layers className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-base font-bold text-white tracking-wide uppercase">Dynamic Playlist Looper</h3>
            <p className="mt-3 text-slate-400 text-xs leading-relaxed font-semibold">
              Upload video MP4 files, arrange your playlist, and play on infinite repeat. Stream stays active 24 hours a day with seamless media transition loops.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="p-8 bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-900 rounded-3xl hover:border-amber-500/20 transition-all duration-300 group shadow-lg shadow-black/50">
            <div className="w-13 h-13 bg-amber-950/40 border border-amber-500/15 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
              <Cpu className="w-6 h-6 text-amber-500" />
            </div>
            <h3 className="text-base font-bold text-white tracking-wide uppercase">Continuous Scheduler</h3>
            <p className="mt-3 text-slate-400 text-xs leading-relaxed font-semibold">
              Plan precise timetables for specific video feeds. The scheduling core activates and switches live video sources on target feeds unattended.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="p-8 bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-900 rounded-3xl hover:border-emerald-500/20 transition-all duration-300 group shadow-lg shadow-black/50">
            <div className="w-13 h-13 bg-emerald-950/40 border border-emerald-500/15 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-base font-bold text-white tracking-wide uppercase">Operator Access Guard</h3>
            <p className="mt-3 text-slate-400 text-xs leading-relaxed font-semibold">
              Secure administrative access is managed with local user operator hashes and approval flags. Keeps uninvited users from altering streams.
            </p>
          </div>

          {/* Feature 5 */}
          <div className="p-8 bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-900 rounded-3xl hover:border-purple-500/20 transition-all duration-300 group shadow-lg shadow-black/50">
            <div className="w-13 h-13 bg-purple-950/40 border border-purple-500/15 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
              <Database className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-base font-bold text-white tracking-wide uppercase">Drive Cloud Auto-Sync</h3>
            <p className="mt-3 text-slate-400 text-xs leading-relaxed font-semibold">
              Synchronize playlists, target stream keys, and broadcast schedules to Google Drive file blocks automatically, preventing local server data wipes.
            </p>
          </div>

          {/* Feature 6 */}
          <div className="p-8 bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-900 rounded-3xl hover:border-cyan-500/20 transition-all duration-300 group shadow-lg shadow-black/50">
            <div className="w-13 h-13 bg-cyan-950/40 border border-cyan-500/15 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
              <BarChart3 className="w-6 h-6 text-cyan-400" />
            </div>
            <h3 className="text-base font-bold text-white tracking-wide uppercase">Analytics HUD & logs</h3>
            <p className="mt-3 text-slate-400 text-xs leading-relaxed font-semibold">
              Monitor active video metadata, loop times, RTMP output bitrates, and detailed operation telemetry in a clean consolidated controller workspace.
            </p>
          </div>

        </div>
      </section>

      {/* Cloud Auto-Sync Recovery Integration Segment */}
      <section id="sync" className="py-20 px-6 bg-slate-900/20 border-t border-slate-900">
        <div className="max-w-5xl mx-auto bg-gradient-to-br from-slate-900/90 to-slate-950 border border-slate-800 p-8 md:p-12 rounded-3xl relative overflow-hidden flex flex-col md:flex-row items-center gap-10">
          
          {/* Ambient Glow */}
          <div className="absolute top-[-50px] right-[-50px] w-64 h-64 bg-red-600/10 rounded-full blur-[70px]"></div>

          <div className="flex-1 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-950/40 border border-red-900/30 rounded-lg text-[10px] font-bold text-red-400 uppercase tracking-wider">
              Google Workspace OAuth Integration
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Instant Cloud Restores & Safety
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed font-medium">
              We understand how tedious re-configuring destinations and schedules is if the server environment restarts. 
            </p>
            <p className="text-slate-400 text-sm leading-relaxed font-medium">
              By authorizing with your Google account, Streamer 24/7 initiates active local-state background auto-saves. If a new node spawns or is wiped, your live broadcaster auto-restores its state on boot.
            </p>
            
            <div className="pt-2 flex flex-col sm:flex-row gap-4">
              <div className="flex items-center gap-2.5 text-xs text-slate-300 font-semibold">
                <Check className="w-4.5 h-4.5 text-red-500 shrink-0" />
                Zero storage cost - saves to your Drive
              </div>
              <div className="flex items-center gap-2.5 text-xs text-slate-300 font-semibold">
                <Check className="w-4.5 h-4.5 text-red-500 shrink-0" />
                No local config database locks
              </div>
            </div>
          </div>

          {/* Interactive Cloud Recovery Visualizer Animation */}
          <div className="w-full md:w-80 bg-slate-950 border border-slate-800/80 p-5 rounded-2xl shadow-xl flex flex-col gap-4 relative">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Sync Flow Visualizer</p>
            
            <div className="flex items-center justify-between px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-center">
                  <Monitor className="w-4 h-4 text-red-500" />
                </div>
                <span className="text-xs font-bold text-white">Operator Core</span>
              </div>
              <span className="text-[9px] font-mono font-bold text-red-400">Changed</span>
            </div>

            <div className="flex justify-center my-0.5">
              <div className="flex flex-col items-center gap-1 text-slate-500">
                <div className="h-6 w-0.5 bg-gradient-to-b from-red-500 to-blue-400 animate-pulse"></div>
                <span className="text-[9px] font-bold uppercase tracking-widest animate-pulse text-blue-400">Auto-Saving</span>
                <div className="h-6 w-0.5 bg-gradient-to-b from-blue-400 to-emerald-500 animate-pulse"></div>
              </div>
            </div>

            <div className="flex items-center justify-between px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center justify-center">
                  <CloudLightning className="w-4 h-4 text-blue-400" />
                </div>
                <span className="text-xs font-bold text-white">Google Drive Backup</span>
              </div>
              <span className="text-[9px] font-mono font-bold text-emerald-400 flex items-center gap-1">
                <Check className="w-3 h-3" />
                Synced
              </span>
            </div>
          </div>

        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 px-6 border-t border-slate-900 bg-slate-950 relative overflow-hidden">
        {/* Subtle decorative orb */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-red-500/5 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="max-w-7xl mx-auto w-full relative z-10">
          <div className="text-center mb-16">
            <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest px-3 py-1.5 bg-red-950/30 border border-red-900/30 rounded-full inline-block mb-3.5">
              Pricing Options
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Flexible Plans For Every Broadcaster
            </h2>
            <p className="mt-3.5 text-slate-400 text-sm sm:text-base max-w-xl mx-auto font-medium">
              Start free self-hosting or activate professional automated cloud pipes. Cancel or scale anytime.
            </p>

            {/* Monthly / Yearly Switch */}
            <div className="mt-8 inline-flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl">
              <button
                onClick={() => setPricingPeriod('monthly')}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                  pricingPeriod === 'monthly'
                    ? 'bg-red-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setPricingPeriod('yearly')}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  pricingPeriod === 'yearly'
                    ? 'bg-red-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Yearly
                <span className="text-[9px] bg-emerald-950/80 text-emerald-400 border border-emerald-900/40 px-1.5 py-0.5 rounded-md font-extrabold lowercase">
                  save 20%
                </span>
              </button>
            </div>
          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Plan 1 */}
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-8 flex flex-col justify-between relative group hover:border-slate-700/60 transition-all duration-300">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Starter</p>
                <p className="mt-4 text-3xl font-extrabold text-white">Free</p>
                <p className="text-xs text-slate-500 mt-1 font-medium">For local test loops & hobbyists</p>

                <div className="border-t border-slate-800/60 my-6"></div>

                <ul className="space-y-3.5">
                  <li className="flex items-start gap-2.5 text-xs text-slate-300 font-medium">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    1 Active Broadcast Target
                  </li>
                  <li className="flex items-start gap-2.5 text-xs text-slate-300 font-medium">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    Standard 720p Resolution limit
                  </li>
                  <li className="flex items-start gap-2.5 text-xs text-slate-300 font-medium">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    Manual Playlist Triggering
                  </li>
                  <li className="flex items-start gap-2.5 text-xs text-slate-500 line-through font-medium">
                    Google Drive Auto-Sync Recovery
                  </li>
                  <li className="flex items-start gap-2.5 text-xs text-slate-500 line-through font-medium">
                    Continuous 24/7 Timetable Scheduler
                  </li>
                </ul>
              </div>

              <div className="mt-8">
                <button
                  onClick={() => handleWhatsAppOrder('Starter', 'Free Setup')}
                  className="w-full py-3 px-4 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-200 hover:text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4 fill-emerald-500" viewBox="0 0 24 24">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.457L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.863-9.864.001-2.637-1.03-5.115-2.903-6.99-1.872-1.873-4.352-2.903-6.99-2.903-5.44 0-9.863 4.42-9.866 9.864-.001 1.83.483 3.619 1.4 5.184l-.995 3.633 3.716-.975zm11.367-7.36c-.327-.164-1.93-.953-2.229-1.062-.299-.11-.517-.164-.734.164-.218.327-.844 1.062-1.035 1.28-.19.218-.381.245-.708.081-.327-.164-1.38-.508-2.63-1.622-.972-.867-1.628-1.939-1.819-2.265-.19-.327-.02-.504.143-.667.147-.146.327-.382.49-.573.164-.19.218-.327.327-.545.11-.218.055-.41-.027-.573-.081-.164-.734-1.77-.101-2.012-.294-.396-.582-.395-.8-.395h-.682c-.245 0-.644.093-.982.464-.338.373-1.29 1.26-1.29 3.072 0 1.812 1.319 3.562 1.5 3.81.18.248 2.597 3.966 6.29 5.56.878.378 1.563.604 2.098.774.882.28 1.687.24 2.322.145.708-.106 1.93-.789 2.202-1.512.272-.723.272-1.344.19-1.472-.081-.128-.299-.19-.627-.354z"/>
                  </svg>
                  Get Started Free
                </button>
              </div>
            </div>

            {/* Plan 2 - Featured */}
            <div className="bg-slate-900/80 border-2 border-red-500/40 rounded-2xl p-8 flex flex-col justify-between relative shadow-xl shadow-red-950/10 group scale-100 lg:scale-105">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-red-600 to-amber-500 text-white text-[9px] font-black uppercase tracking-wider rounded-full shadow-lg">
                Most Popular
              </div>

              <div>
                <p className="text-xs font-bold text-red-400 uppercase tracking-widest">Creator Pro</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-black text-white">
                    ${pricingPeriod === 'monthly' ? '19' : '15'}
                  </span>
                  <span className="text-xs text-slate-500 font-bold uppercase">/ month</span>
                </div>
                <p className="text-xs text-slate-400 mt-1 font-medium">Continuous reliable stream automated loops</p>

                <div className="border-t border-slate-800/60 my-6"></div>

                <ul className="space-y-3.5">
                  <li className="flex items-start gap-2.5 text-xs text-slate-200 font-semibold">
                    <Check className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    Unlimited Stream Targets
                  </li>
                  <li className="flex items-start gap-2.5 text-xs text-slate-200 font-semibold">
                    <Check className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    Full 1080p60 High Bitrate Casting
                  </li>
                  <li className="flex items-start gap-2.5 text-xs text-slate-200 font-semibold">
                    <Check className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    Dynamic Continuous Scheduler
                  </li>
                  <li className="flex items-start gap-2.5 text-xs text-slate-200 font-semibold">
                    <Check className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    Google Drive Cloud Auto-Sync Recovery
                  </li>
                  <li className="flex items-start gap-2.5 text-xs text-slate-200 font-semibold">
                    <Check className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    Full Analytics & Priority Encoding
                  </li>
                </ul>
              </div>

              <div className="mt-8">
                <button
                  onClick={() => handleWhatsAppOrder('Creator Pro', pricingPeriod === 'monthly' ? '$19/mo' : '$15/mo ($180/yr)')}
                  className="w-full py-3 px-4 bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-lg shadow-red-950/40 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4 fill-current text-white" viewBox="0 0 24 24">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.457L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.863-9.864.001-2.637-1.03-5.115-2.903-6.99-1.872-1.873-4.352-2.903-6.99-2.903-5.44 0-9.863 4.42-9.866 9.864-.001 1.83.483 3.619 1.4 5.184l-.995 3.633 3.716-.975zm11.367-7.36c-.327-.164-1.93-.953-2.229-1.062-.299-.11-.517-.164-.734.164-.218.327-.844 1.062-1.035 1.28-.19.218-.381.245-.708.081-.327-.164-1.38-.508-2.63-1.622-.972-.867-1.628-1.939-1.819-2.265-.19-.327-.02-.504.143-.667.147-.146.327-.382.49-.573.164-.19.218-.327.327-.545.11-.218.055-.41-.027-.573-.081-.164-.734-1.77-.101-2.012-.294-.396-.582-.395-.8-.395h-.682c-.245 0-.644.093-.982.464-.338.373-1.29 1.26-1.29 3.072 0 1.812 1.319 3.562 1.5 3.81.18.248 2.597 3.966 6.29 5.56.878.378 1.563.604 2.098.774.882.28 1.687.24 2.322.145.708-.106 1.93-.789 2.202-1.512.272-.723.272-1.344.19-1.472-.081-.128-.299-.19-.627-.354z"/>
                  </svg>
                  Order Pro on WhatsApp
                </button>
              </div>
            </div>

            {/* Plan 3 */}
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-8 flex flex-col justify-between relative group hover:border-slate-700/60 transition-all duration-300">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Enterprise Network</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-black text-white">
                    ${pricingPeriod === 'monthly' ? '49' : '39'}
                  </span>
                  <span className="text-xs text-slate-500 font-bold uppercase">/ month</span>
                </div>
                <p className="text-xs text-slate-500 mt-1 font-medium">For studio channels & professional media</p>

                <div className="border-t border-slate-800/60 my-6"></div>

                <ul className="space-y-3.5">
                  <li className="flex items-start gap-2.5 text-xs text-slate-300 font-medium">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    Dedicated Ingest Servers & IP address
                  </li>
                  <li className="flex items-start gap-2.5 text-xs text-slate-300 font-medium">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    Up to 4K Ultra HD casting capabilities
                  </li>
                  <li className="flex items-start gap-2.5 text-xs text-slate-300 font-medium">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    Team operator invites & access controls
                  </li>
                  <li className="flex items-start gap-2.5 text-xs text-slate-300 font-medium">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    Real-time video SRT protocol ingest
                  </li>
                  <li className="flex items-start gap-2.5 text-xs text-slate-300 font-medium">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    24/7 dedicated engineer SLA support
                  </li>
                </ul>
              </div>

              <div className="mt-8">
                <button
                  onClick={() => handleWhatsAppOrder('Enterprise Network', pricingPeriod === 'monthly' ? '$49/mo' : '$39/mo ($468/yr)')}
                  className="w-full py-3 px-4 bg-slate-950 hover:bg-slate-900 border border-slate-850 text-slate-300 hover:text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4 fill-emerald-500" viewBox="0 0 24 24">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.457L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.863-9.864.001-2.637-1.03-5.115-2.903-6.99-1.872-1.873-4.352-2.903-6.99-2.903-5.44 0-9.863 4.42-9.866 9.864-.001 1.83.483 3.619 1.4 5.184l-.995 3.633 3.716-.975zm11.367-7.36c-.327-.164-1.93-.953-2.229-1.062-.299-.11-.517-.164-.734.164-.218.327-.844 1.062-1.035 1.28-.19.218-.381.245-.708.081-.327-.164-1.38-.508-2.63-1.622-.972-.867-1.628-1.939-1.819-2.265-.19-.327-.02-.504.143-.667.147-.146.327-.382.49-.573.164-.19.218-.327.327-.545.11-.218.055-.41-.027-.573-.081-.164-.734-1.77-.101-2.012-.294-.396-.582-.395-.8-.395h-.682c-.245 0-.644.093-.982.464-.338.373-1.29 1.26-1.29 3.072 0 1.812 1.319 3.562 1.5 3.81.18.248 2.597 3.966 6.29 5.56.878.378 1.563.604 2.098.774.882.28 1.687.24 2.322.145.708-.106 1.93-.789 2.202-1.512.272-.723.272-1.344.19-1.472-.081-.128-.299-.19-.627-.354z"/>
                  </svg>
                  Order on WhatsApp
                </button>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Accordion FAQ Section */}
      <section id="faq" className="py-24 px-6 max-w-4xl mx-auto w-full">
        <div className="text-center mb-14">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Frequently Answered Questions
          </h2>
          <p className="mt-3 text-slate-400 text-sm max-w-lg mx-auto font-medium">
            Everything you need to understand about Streamer 24/7.
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = activeFaq === idx;
            return (
              <div 
                key={idx} 
                className="bg-slate-900/40 border border-slate-800/80 rounded-2xl overflow-hidden transition-all duration-200"
              >
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full px-6 py-5 flex items-center justify-between gap-4 text-left cursor-pointer focus:outline-none"
                >
                  <span className="text-sm font-bold text-white hover:text-red-400 transition-colors">
                    {faq.q}
                  </span>
                  <ChevronDown className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-red-500' : ''}`} />
                </button>

                {isOpen && (
                  <div className="px-6 pb-5 pt-1 border-t border-slate-850">
                    <p className="text-slate-400 text-sm leading-relaxed font-medium">
                      {faq.a}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-24 px-6 border-t border-slate-900 bg-slate-950/40 relative">
        <div className="max-w-5xl mx-auto w-full">
          <div className="text-center mb-16">
            <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest px-3 py-1.5 bg-red-950/30 border border-red-900/30 rounded-full inline-block mb-3.5">
              Contact Desk
            </span>
            <h2 className="text-3xl font-extrabold text-white tracking-tight">
              Get In Touch With Operator Support
            </h2>
            <p className="mt-3.5 text-slate-400 text-sm max-w-lg mx-auto font-medium">
              Have questions about configuring your destinations, schedules, or Google Drive saves? Shoot us a message below!
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 items-stretch">
            
            {/* Left Contact Info Column */}
            <div className="md:col-span-5 bg-slate-900/55 border border-slate-800 p-8 rounded-2xl flex flex-col justify-between gap-8">
              <div className="space-y-6">
                <h3 className="text-base font-bold text-white uppercase tracking-wider">Broadcaster Inquiries</h3>
                
                <div className="space-y-4">
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-center text-red-400 shrink-0">
                      <Mail className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Support Email</p>
                      <p className="text-sm font-semibold text-slate-200 mt-0.5">operator@streamer247.io</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center text-blue-400 shrink-0">
                      <MessageSquare className="w-4.5 h-4.5 animate-pulse" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Live IRC Network</p>
                      <p className="text-sm font-semibold text-slate-200 mt-0.5">#streamer247 on Libera.Chat</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400 shrink-0">
                      <ShieldCheck className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">SLA Uptime Commitment</p>
                      <p className="text-sm font-semibold text-slate-200 mt-0.5">99.95% Continuous Ingestion Guarantee</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-800/80">
                <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                  Our core background scheduler and media decoders are open-source and monitored by community operators around the clock.
                </p>
              </div>
            </div>

            {/* Right Contact Form Column */}
            <div className="md:col-span-7 bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl">
              <form onSubmit={handleContactSubmit} className="space-y-5">
                
                {contactSuccess && (
                  <div className="p-4 bg-emerald-950/40 border border-emerald-900/50 rounded-xl flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5 animate-bounce" />
                    <p className="text-xs text-emerald-200 leading-relaxed font-medium">{contactSuccess}</p>
                  </div>
                )}

                {contactError && (
                  <div className="p-4 bg-red-950/40 border border-red-900/50 rounded-xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-200 leading-relaxed font-medium">{contactError}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Full Name</label>
                    <input
                      type="text"
                      required
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-red-500 text-xs font-semibold transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Email Address</label>
                    <input
                      type="email"
                      required
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="jane@example.com"
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-red-500 text-xs font-semibold transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Subject</label>
                  <input
                    type="text"
                    value={contactSubject}
                    onChange={(e) => setContactSubject(e.target.value)}
                    placeholder="E.g., Ingestion target query, custom setup details"
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-red-500 text-xs font-semibold transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Message</label>
                  <textarea
                    required
                    rows={4}
                    value={contactMessage}
                    onChange={(e) => setContactMessage(e.target.value)}
                    placeholder="Describe how we can help you configure your continuous live system..."
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-red-500 text-xs font-semibold transition-colors resize-none"
                  ></textarea>
                </div>

                <button
                  type="submit"
                  disabled={contactSending}
                  className="w-full py-3 px-4 bg-red-600 hover:bg-red-500 disabled:bg-red-800/40 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-200 shadow-lg shadow-red-950/40 flex items-center justify-center gap-2 cursor-pointer border border-red-500/20"
                >
                  {contactSending ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Sending Message...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      Dispatch Message
                    </>
                  )}
                </button>

              </form>
            </div>

          </div>
        </div>
      </section>

      {/* Elegant Footer */}
      <footer className="mt-auto border-t border-slate-900 bg-slate-950 px-6 py-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-center">
              <Radio className="w-4.5 h-4.5 text-red-500" />
            </div>
            <div>
              <p className="text-xs font-extrabold text-white uppercase tracking-wider leading-none">Streamer 24/7</p>
              <p className="text-[9px] text-slate-500 mt-0.5 leading-none font-medium">Continuous Broadcast Console</p>
            </div>
          </div>

          {/* Development Credit with Facebook and WhatsApp */}
          <div className="flex flex-col items-center md:items-center text-center gap-2">
            <p className="text-[11px] text-slate-400 font-medium">
              Development By <span className="text-white font-bold">Digital Ledger Solutions</span>
            </p>
            <div className="flex items-center gap-4">
              <a 
                href="https://www.facebook.com/DigitalLedgerSolutions" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center gap-1.5 text-[10px] font-bold text-blue-400 hover:text-blue-300 transition-colors uppercase tracking-wider bg-blue-950/30 px-2.5 py-1 rounded-md border border-blue-900/30"
              >
                <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Facebook
              </a>
              <a 
                href="https://wa.me/8801889933520" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors uppercase tracking-wider bg-emerald-950/30 px-2.5 py-1 rounded-md border border-emerald-900/30"
              >
                <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.457L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.863-9.864.001-2.637-1.03-5.115-2.903-6.99-1.872-1.873-4.352-2.903-6.99-2.903-5.44 0-9.863 4.42-9.866 9.864-.001 1.83.483 3.619 1.4 5.184l-.995 3.633 3.716-.975zm11.367-7.36c-.327-.164-1.93-.953-2.229-1.062-.299-.11-.517-.164-.734.164-.218.327-.844 1.062-1.035 1.28-.19.218-.381.245-.708.081-.327-.164-1.38-.508-2.63-1.622-.972-.867-1.628-1.939-1.819-2.265-.19-.327-.02-.504.143-.667.147-.146.327-.382.49-.573.164-.19.218-.327.327-.545.11-.218.055-.41-.027-.573-.081-.164-.734-1.77-.101-2.012-.294-.396-.582-.395-.8-.395h-.682c-.245 0-.644.093-.982.464-.338.373-1.29 1.26-1.29 3.072 0 1.812 1.319 3.562 1.5 3.81.18.248 2.597 3.966 6.29 5.56.878.378 1.563.604 2.098.774.882.28 1.687.24 2.322.145.708-.106 1.93-.789 2.202-1.512.272-.723.272-1.344.19-1.472-.081-.128-.299-.19-.627-.354z"/>
                </svg>
                WhatsApp
              </a>
            </div>
          </div>

          <div className="text-center md:text-right">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              Securely Protected with Firebase Auth & SQLite DB
            </p>
            <p className="text-[10px] text-slate-600 mt-1 font-medium">
              &copy; {new Date().getFullYear()} Streamer 24/7. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* Operator Login / Registration Modal Slide-Over */}
      <AnimatePresence>
        {showAuthModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Modal backdrop background */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAuthModal(false)}
              className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm cursor-pointer"
            ></motion.div>

            {/* Modal Content */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="w-full max-w-md bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl relative z-10 max-h-[92vh] overflow-y-auto"
            >
              {/* Close Button */}
              <button 
                onClick={() => setShowAuthModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-all"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex flex-col items-center mb-6">
                <div className="w-14 h-14 bg-red-600/10 border border-red-500/20 rounded-2xl flex items-center justify-center mb-3.5">
                  {isRegisterMode ? (
                    <UserPlus className="w-7 h-7 text-red-500 animate-pulse" />
                  ) : (
                    <Radio className="w-7 h-7 text-red-500 animate-pulse" />
                  )}
                </div>
                <h3 className="text-xl font-bold tracking-tight text-white text-center">
                  {isRegisterMode ? 'Register New Operator' : 'Operator Desk Login'}
                </h3>
                <p className="text-xs text-slate-400 mt-1 text-center">
                  {isRegisterMode ? 'Sign up and wait for operator clearance approval' : 'Verify operator hashes or sign in with Gmail'}
                </p>
              </div>

              {error && (
                <div className="mb-5 p-3.5 bg-red-950/40 border border-red-900/50 rounded-xl flex items-start gap-2.5">
                  <AlertCircle className="w-4.5 h-4.5 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-200 leading-normal font-medium">{error}</p>
                </div>
              )}

              {success && (
                <div className="mb-5 p-3.5 bg-emerald-950/40 border border-emerald-900/50 rounded-xl flex items-start gap-2.5">
                  <CheckCircle className="w-4.5 h-4.5 text-emerald-400 shrink-0 mt-0.5 animate-bounce" />
                  <p className="text-xs text-emerald-200 leading-normal font-medium">{success}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Username</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                      <User className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition-colors font-medium"
                      placeholder={isRegisterMode ? 'Choose operator username' : 'Enter admin username'}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Password</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition-colors font-medium"
                      placeholder="Enter safe password"
                      required
                    />
                  </div>
                </div>

                {isRegisterMode && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Confirm Password</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                        <Lock className="w-4 h-4" />
                      </span>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition-colors font-medium"
                        placeholder="Repeat your password"
                        required
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 disabled:bg-red-800/50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-colors shadow-lg shadow-red-900/20 flex items-center justify-center gap-2 mt-2 cursor-pointer"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : isRegisterMode ? (
                    'Create Account'
                  ) : (
                    'Verify & Enter Desk'
                  )}
                </button>
              </form>

              <div className="relative my-4.5 flex items-center justify-center">
                <span className="absolute left-0 right-0 border-t border-slate-850"></span>
                <span className="relative bg-slate-900 px-3.5 text-[9px] text-slate-500 uppercase tracking-widest font-bold">Or continue with</span>
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full py-2.5 px-4 bg-slate-950 hover:bg-slate-900 border border-slate-850 text-slate-200 hover:text-white font-bold text-xs rounded-xl transition-all duration-200 flex items-center justify-center gap-2.5 cursor-pointer hover:border-slate-800 shadow-md"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                </svg>
                <span>Gmail / Google Login</span>
              </button>

              <div className="mt-5 text-center border-t border-slate-850 pt-5">
                <p className="text-xs text-slate-400 font-semibold">
                  {isRegisterMode ? 'Already have an account?' : "Don't have an account?"}{' '}
                  <button
                    type="button"
                    onClick={toggleMode}
                    className="text-red-500 hover:text-red-400 font-extrabold focus:outline-none cursor-pointer transition-colors ml-1"
                  >
                    {isRegisterMode ? 'Login here' : 'Register here'}
                  </button>
                </p>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
