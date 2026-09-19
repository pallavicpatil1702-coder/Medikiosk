import re

with open('src/app/patient/dashboard/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Prepare customMenu
custom_menu = """
  const customMenu = (
    <div className="relative">
      <button 
        onClick={() => setMenuOpen(!menuOpen)}
        className="w-10 h-10 rounded-xl bg-[#234e32]/10 text-[#234e32] hover:bg-[#234e32]/20 border border-[#234e32]/20 flex items-center justify-center transition shrink-0 focus:outline-none"
      >
        <MoreVertical size={20} />
      </button>
      
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)}></div>
          <div className="absolute left-0 top-12 mt-1 w-56 rounded-3xl bg-[#fbf9f4] border border-[#ded5c2] shadow-xl p-2 z-50 flex flex-col">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMenuOpen(false);
                  }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition ${
                    isActive 
                      ? 'bg-[#234e32] text-white' 
                      : 'text-[#4d2f19] hover:bg-[#ede5d6]'
                  }`}
                >
                  <Icon size={16} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );

  return (
    <AyurvedaBackground variant="kiosk">
      <Header title="Patient Health Portal" backHref="/" customLeftMenu={customMenu} />
"""

old_return = """  return (
    <AyurvedaBackground variant="kiosk">
      <Header title="Patient Health Portal" backHref="/" />"""
      
content = content.replace(old_return, custom_menu)

# 2. Replace the Welcome Header to remove Sign Out and 3-dots
old_welcome = """        {/* Welcome Header */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-6 border-b border-[#ded5c2]">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-3xl bg-[#e4ede1] text-[#234e32] border border-[#c7d9c2] flex items-center justify-center font-extrabold text-xl shadow-md shrink-0">
              <User size={28} />
            </div>
            <div>
              <div className="flex items-center flex-wrap gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#1b3d27]">
                  Welcome back, {patientProfile?.name || currentUser?.displayName || (currentUser?.email ? currentUser.email.split('@')[0] : 'Patient')}
                </h1>
                <span className="px-3 py-0.5 rounded-full bg-[#e4ede1] border border-[#c7d9c2] text-[#234e32] text-xs font-bold uppercase tracking-wider">
                  Verified Patient
                </span>
              </div>
              <p className="text-xs text-[#556358] mt-1.5 leading-relaxed max-w-xl">
                {patientProfile && (
                  <span className="mr-3 block mb-1">
                    <span className="font-semibold">Age:</span> {patientProfile.age} | <span className="font-semibold">Gender:</span> {patientProfile.gender} | <span className="font-semibold">Contact:</span> {patientProfile.contact}
                  </span>
                )}
                UID: <span className="font-mono text-[#1c241e] font-semibold">{currentUser?.uid}</span> • {currentUser?.email}
              </p>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-end sm:items-center gap-3 relative">
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#fbf9f4] hover:bg-[#ede5d6] text-[#4d2f19] text-xs font-bold transition border border-[#ded5c2] shadow-xs"
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
            
            {/* 3 Dots Menu Button */}
            <div className="relative">
              <button 
                onClick={() => setMenuOpen(!menuOpen)}
                className="w-10 h-10 rounded-2xl bg-[#fbf9f4] border border-[#ded5c2] hover:bg-[#ede5d6] text-[#1b3d27] flex items-center justify-center shadow-xs transition focus:outline-none focus:ring-2 focus:ring-[#234e32]/30"
              >
                <MoreVertical size={20} />
              </button>
              
              {/* Dropdown Menu */}
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)}></div>
                  <div className="absolute right-0 top-12 mt-1 w-56 rounded-3xl bg-[#fbf9f4] border border-[#ded5c2] shadow-xl p-2 z-50 flex flex-col">
                    {navItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            setActiveTab(item.id);
                            setMenuOpen(false);
                          }}
                          className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition ${
                            isActive 
                              ? 'bg-[#234e32] text-white' 
                              : 'text-[#4d2f19] hover:bg-[#ede5d6]'
                          }`}
                        >
                          <Icon size={16} />
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>"""

new_welcome = """        {/* Welcome Header */}
        <div className="flex items-start gap-4 pb-6 border-b border-[#ded5c2]">
          <div className="w-14 h-14 rounded-3xl bg-[#e4ede1] text-[#234e32] border border-[#c7d9c2] flex items-center justify-center font-extrabold text-xl shadow-md shrink-0">
            <User size={28} />
          </div>
          <div>
            <div className="flex items-center flex-wrap gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#1b3d27]">
                Welcome back, {patientProfile?.name || currentUser?.displayName || (currentUser?.email ? currentUser.email.split('@')[0] : 'Patient')}
              </h1>
              <span className="px-3 py-0.5 rounded-full bg-[#e4ede1] border border-[#c7d9c2] text-[#234e32] text-xs font-bold uppercase tracking-wider">
                Verified Patient
              </span>
            </div>
            <p className="text-xs text-[#556358] mt-1.5 leading-relaxed max-w-xl">
              {patientProfile && (
                <span className="mr-3 block mb-1">
                  <span className="font-semibold">Age:</span> {patientProfile.age} | <span className="font-semibold">Gender:</span> {patientProfile.gender} | <span className="font-semibold">Contact:</span> {patientProfile.contact}
                </span>
              )}
              UID: <span className="font-mono text-[#1c241e] font-semibold">{currentUser?.uid}</span> • {currentUser?.email}
            </p>
          </div>
        </div>"""

content = content.replace(old_welcome, new_welcome)

with open('src/app/patient/dashboard/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated successfully")
