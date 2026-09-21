import { useEffect, useState } from 'react'
import {
  ArrowRight,
  ArrowUp,
  Bell,
  Box,
  CalendarDays,
  CircleDollarSign,
  FileText,
  ShoppingCart,
  WalletCards,
  Plus,
  Trash2,
  Check,
} from 'lucide-react'
import { strings } from './lib/i18n'
import { useAppStore } from './store/useAppStore'
import type { ShopProfile } from './types/app'
import './App.css'

const tabs = [
  { labelKey: 'sell', icon: ShoppingCart, key: 'sell' },
  { labelKey: 'stock', icon: Box, key: 'stock' },
  { labelKey: 'debts', icon: WalletCards, key: 'deni' },
  { labelKey: 'reports', icon: FileText, key: 'reports' },
] as const

function App() {
  const {
    products,
    cart,
    debts,
    activeTab,
    locale,
    session,
    authError,
    authBusy,
    localUnlockRequired,
    devicePinConfigured,
    syncStatus,
    lastSyncedAt,
    pendingSyncCount,
    lastSaleMessage,
    shopProfile,
    lowStockThreshold,
    isHydrated,
    reportSummary,
    reportDate,
    quickSellProducts,
    cashSession,
    expectedCash,
    creditLimits,
    debtMessage,
    lastSaleReceipt,
    heldCarts,
    addToCart,
    incrementCartItem,
    decrementCartItem,
    removeCartItem,
    clearCart,
    completeSale,
    addProduct,
    receiveStock,
    addDebt,
    payDebt,
    addExpense,
    closeCashSession,
    parkCart,
    resumeHeldCart,
    deleteHeldCart,
    setActiveTab,
    setReportDate,
    setLocale,
    signIn,
    registerCashier,
    resendConfirmation,
    requestPasswordReset,
    updatePassword,
    inviteCashier,
    logout,
    completeOnboarding,
    setDevicePin,
    unlockWithPin,
    updateShopProfile,
    setLowStockThreshold,
    syncNow,
    hydrateLocalState,
  } = useAppStore()

  useEffect(() => {
    void hydrateLocalState()
  }, [hydrateLocalState])

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('reset') === '1') setAuthMode('reset')
  }, [])

  const t = strings[locale]
  const [searchTerm, setSearchTerm] = useState('')
  const [newProductName, setNewProductName] = useState('')
  const [newProductPrice, setNewProductPrice] = useState('')
  const [newProductStock, setNewProductStock] = useState('')
  const [newProductDenomination, setNewProductDenomination] = useState<'quarter' | 'half' | 'three-quarter' | 'full' | 'unit'>('full')
  const [stockReceipt, setStockReceipt] = useState<Record<string, string>>({})
  const [restockCoverDays, setRestockCoverDays] = useState(7)
  const [restockQuantities, setRestockQuantities] = useState<Record<string, string>>({})
  const [debtCustomer, setDebtCustomer] = useState('')
  const [debtPhone, setDebtPhone] = useState('')
  const [debtProductId, setDebtProductId] = useState(products[0]?.id ?? '')
  const [debtQuantity, setDebtQuantity] = useState('1')
  const [debtLimit, setDebtLimit] = useState('')
  const [debtPayments, setDebtPayments] = useState<Record<string, string>>({})
  const [debtPaymentMethod, setDebtPaymentMethod] = useState<'cash' | 'mpesa'>('cash')
  const [expenseTitle, setExpenseTitle] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseCategory, setExpenseCategory] = useState<'rent' | 'transport' | 'stock' | 'airtime' | 'electricity' | 'water' | 'wages' | 'licence' | 'food' | 'cash_drop' | 'other'>('other')
  const [expensePayment, setExpensePayment] = useState<'cash' | 'mpesa'>('cash')
  const [showCloseDay, setShowCloseDay] = useState(false)
  const [countedCash, setCountedCash] = useState('')
  const [closeNote, setCloseNote] = useState('')
  const [receiptMessage, setReceiptMessage] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [profileForm, setProfileForm] = useState<ShopProfile>({ shopName: '', ownerName: '', phone: '', pin: '' })
  const [cashierEmail, setCashierEmail] = useState('')
  const [inviteMessage, setInviteMessage] = useState('')
  const [lowStockThresholdForm, setLowStockThresholdForm] = useState('5')
  const [onboarding, setOnboarding] = useState<ShopProfile>({ shopName: '', ownerName: '', phone: '', pin: '' })
  const [authMode, setAuthMode] = useState<'signup' | 'signin' | 'cashier-signup' | 'reset'>('signup')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authConfirmPassword, setAuthConfirmPassword] = useState('')
  const [authUsername, setAuthUsername] = useState('')
  const [devicePin, setDevicePinValue] = useState('')
  const [showSetDevicePin, setShowSetDevicePin] = useState(false)
  const cartTotal = cart.reduce((total, item) => total + item.unitPrice * item.qty, 0)
  const cartCount = cart.reduce((total, item) => total + item.qty, 0)
  const debtTotal = debts.reduce((total, debt) => total + Math.max(debt.amount - debt.paid, 0), 0)
  const visibleProducts = products.filter((product) => product.name.toLocaleLowerCase().includes(searchTerm.toLocaleLowerCase().trim()))
  const restockCandidates = products
    .filter((product) => product.stock <= lowStockThreshold)
    .sort((left, right) => left.stock - right.stock)
  const restockTotal = restockCandidates.reduce((total, product) => {
    const suggested = Number(restockQuantities[product.id] ?? Math.max(lowStockThreshold * 2 - product.stock, 1))
    return total + suggested * product.buying_price
  }, 0)

  const handleAddDebt = () => {
    const product = products.find((item) => item.id === debtProductId)
    const qty = Number(debtQuantity)
    if (!debtCustomer.trim() || !debtPhone.trim() || !product || !Number.isInteger(qty) || qty <= 0) return

    const limit = debtLimit.trim() ? Number(debtLimit) : null
    if (limit !== null && (!Number.isInteger(limit) || limit < 0)) return
    void addDebt(debtCustomer.trim(), debtPhone.trim(), [{
      productId: product.id,
      productName: product.name,
      qty,
      unitPrice: product.selling_price,
    }], limit)
    setDebtCustomer('')
    setDebtPhone('')
    setDebtQuantity('1')
    setDebtLimit('')
  }

  const handleCheckout = () => {
    void completeSale()
  }

  const handleCreateProduct = () => {
    const name = newProductName.trim()
    const sellingPrice = Number(newProductPrice)
    const stock = Number(newProductStock || 0)
    if (!name || !Number.isFinite(sellingPrice) || sellingPrice <= 0 || !Number.isInteger(stock) || stock < 0) return

    addProduct({
      name,
      buying_price: 0,
      selling_price: sellingPrice,
      low_limit: lowStockThreshold,
      unit: 'pcs',
      stock,
      denomination: newProductDenomination,
      base_unit: 'kg',
    })
    setNewProductName('')
    setNewProductPrice('')
    setNewProductStock('')
    setNewProductDenomination('full')
  }

  const handleAddExpense = () => {
    const amount = Number(expenseAmount)
    if (!expenseTitle.trim() || !Number.isInteger(amount) || amount <= 0) return
    void addExpense(expenseTitle, amount, expenseCategory, expensePayment)
    setExpenseTitle('')
    setExpenseAmount('')
  }

  const handleCloseDay = () => {
    const counted = Number(countedCash)
    if (!Number.isInteger(counted) || counted < 0) return
    void closeCashSession(counted, closeNote).then((closed) => {
      if (closed) setShowCloseDay(false)
    })
  }

  const handleShareReceipt = async () => {
    if (!lastSaleReceipt) return
    if (navigator.share) {
      await navigator.share({ text: lastSaleReceipt })
      return
    }
    await navigator.clipboard?.writeText(lastSaleReceipt)
    setReceiptMessage(t.receiptCopied)
  }

  const handleOnboarding = () => {
    if (!onboarding.shopName.trim() || !onboarding.ownerName.trim() || !authUsername.trim() || !authEmail.trim() || authPassword.length < 8 || authPassword !== authConfirmPassword) return
    void completeOnboarding({
      shopName: onboarding.shopName.trim(),
      ownerName: onboarding.ownerName.trim(),
      username: authUsername.trim().toLowerCase(),
      email: authEmail.trim(),
      password: authPassword,
    }).then((created) => {
      if (created) setShowSetDevicePin(true)
    })
  }

  const handleSignIn = () => {
    if (!authEmail.trim() || !authPassword) return
    void signIn(authEmail.trim(), authPassword)
  }

  const handleDevicePin = () => {
    void unlockWithPin(devicePin).then((unlocked) => {
      if (unlocked) setDevicePinValue('')
    })
  }

  const handleSetDevicePin = () => {
    void setDevicePin(devicePin).then((saved) => {
      if (saved) {
        setDevicePinValue('')
        setShowSetDevicePin(false)
      }
    })
  }

  const handleCashierSignup = () => {
    if (!authEmail.trim() || authPassword.length < 8) return
    void registerCashier(authEmail.trim(), authPassword)
  }

  const handleResendConfirmation = () => {
    if (authEmail.trim()) void resendConfirmation(authEmail.trim())
  }

  const handlePasswordResetRequest = () => {
    if (authEmail.trim()) void requestPasswordReset(authEmail.trim())
  }

  const handlePasswordUpdate = () => {
    if (authPassword.length < 8 || authPassword !== authConfirmPassword) return
    void updatePassword(authPassword).then((updated) => {
      if (updated) {
        window.history.replaceState({}, '', window.location.pathname)
        setAuthPassword('')
        setAuthConfirmPassword('')
        setAuthMode('signin')
      }
    })
  }

  const handleInviteCashier = () => {
    if (!cashierEmail.trim()) return
    void inviteCashier(cashierEmail.trim()).then((sent) => {
      setInviteMessage(sent ? 'Invitation created. The cashier can register with this email.' : '')
      if (sent) setCashierEmail('')
    })
  }

  const openSettings = () => {
    if (shopProfile) setProfileForm(shopProfile)
    setLowStockThresholdForm(String(lowStockThreshold))
    setShowSettings(true)
  }

  const handleProfileUpdate = () => {
    if (!profileForm.shopName.trim() || !profileForm.ownerName.trim() || !profileForm.phone.trim()) return
    const threshold = Number(lowStockThresholdForm)
    if (!Number.isInteger(threshold) || threshold < 0) return
    void Promise.all([
      updateShopProfile({ ...profileForm, shopName: profileForm.shopName.trim(), ownerName: profileForm.ownerName.trim(), phone: profileForm.phone.trim() }),
      setLowStockThreshold(threshold),
    ]).then(() => setShowSettings(false))
  }

  if (!isHydrated) return null

  if (localUnlockRequired) {
    return (
      <div className="app-shell onboarding-shell">
        <main className="onboarding-card">
          <p className="eyebrow">SmartSort Sales Manager</p>
          <h1>Fungua simu</h1>
          <p className="onboarding-copy">Tumia PIN ya kifaa kuona data yako bila intaneti.</p>
          <div className="onboarding-form">
            <input aria-label="Device PIN" placeholder="PIN ya kifaa" inputMode="numeric" type="password" maxLength={6} value={devicePin} onChange={(event) => setDevicePinValue(event.target.value.replace(/\D/g, ''))} />
            {authError && <div className="auth-message" role="alert">{authError}</div>}
            <button type="button" className="primary-action" disabled={devicePin.length < 4} onClick={handleDevicePin}>Fungua</button>
          </div>
        </main>
      </div>
    )
  }

  if (showSetDevicePin && session && !devicePinConfigured) {
    return (
      <div className="app-shell onboarding-shell">
        <main className="onboarding-card">
          <p className="eyebrow">SmartSort Sales Manager</p>
          <h1>Weka PIN ya kifaa</h1>
          <p className="onboarding-copy">PIN hii inabaki kwenye simu hii pekee. Haitumiki kama password ya akaunti.</p>
          <div className="onboarding-form">
            <input aria-label="Device PIN" placeholder="PIN ya tarakimu 4 hadi 6" inputMode="numeric" type="password" maxLength={6} value={devicePin} onChange={(event) => setDevicePinValue(event.target.value.replace(/\D/g, ''))} />
            <button type="button" className="primary-action" disabled={devicePin.length < 4} onClick={handleSetDevicePin}>Hifadhi PIN</button>
          </div>
        </main>
      </div>
    )
  }

  if (!shopProfile || !session) {
    return (
      <div className="app-shell onboarding-shell">
        <main className="onboarding-card">
          <p className="eyebrow">SmartSort Sales Manager</p>
          <h1>{authMode === 'signup' ? 'Set up your shop' : authMode === 'cashier-signup' ? 'Join your shop' : authMode === 'reset' ? 'Set a new password' : 'Welcome back'}</h1>
          <p className="onboarding-copy">{authMode === 'signup' ? 'Create your secure owner account and add your shop details.' : authMode === 'cashier-signup' ? 'Use the email address your shop owner invited.' : authMode === 'reset' ? 'Choose a new password for your account.' : 'Sign in to continue managing your shop securely.'}</p>
          <div className="onboarding-form">
            {authMode === 'signup' && <>
              <input aria-label="Shop name" placeholder="Shop name" value={onboarding.shopName} onChange={(event) => setOnboarding({ ...onboarding, shopName: event.target.value })} />
              <input aria-label="Owner name" placeholder="Owner name" value={onboarding.ownerName} onChange={(event) => setOnboarding({ ...onboarding, ownerName: event.target.value })} />
              <input aria-label="Username" placeholder="Username (a-z, 0-9, _, .)" autoComplete="username" value={authUsername} onChange={(event) => setAuthUsername(event.target.value.toLowerCase())} />
            </>}
            {authMode !== 'reset' && <input aria-label={authMode === 'signin' ? 'Username or email' : 'Email address'} placeholder={authMode === 'signin' ? 'Username or email' : 'Email address'} type={authMode === 'signin' ? 'text' : 'email'} autoComplete={authMode === 'signin' ? 'username' : 'email'} value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} />}
            {authMode !== 'reset' && <input aria-label="Password" placeholder="Password (8+ characters)" type="password" autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} />}
            {(authMode === 'signup' || authMode === 'reset') && <input aria-label="Confirm password" placeholder="Confirm password" type="password" autoComplete="new-password" value={authConfirmPassword} onChange={(event) => setAuthConfirmPassword(event.target.value)} />}
            {authMode !== 'cashier-signup' && typeof navigator !== 'undefined' && !navigator.onLine && <div className="auth-message">{authMode === 'signup' ? 'Signup inahitaji intaneti.' : 'Unahitaji intaneti kwa mara ya kwanza kwenye simu hii.'}</div>}
            {authError && <div className="auth-message" role="alert">{authError}</div>}
            <button type="button" className="primary-action" disabled={authBusy || (authMode !== 'reset' && typeof navigator !== 'undefined' && !navigator.onLine)} onClick={authMode === 'signup' ? handleOnboarding : authMode === 'cashier-signup' ? handleCashierSignup : authMode === 'reset' ? handlePasswordUpdate : handleSignIn}>{authBusy ? 'Please wait...' : authMode === 'signup' ? 'Create owner account' : authMode === 'cashier-signup' ? 'Create cashier account' : authMode === 'reset' ? 'Update password' : 'Sign in'}</button>
            {authMode === 'signin' && <button type="button" className="auth-switch" onClick={handlePasswordResetRequest}>Forgot password?</button>}
            {(authMode === 'signin' || authMode === 'signup') && <button type="button" className="auth-switch" onClick={handleResendConfirmation}>Resend confirmation email</button>}
            {authMode !== 'reset' && <button type="button" className="auth-switch" onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}>
              {authMode === 'signin' ? 'Need an owner account? Create one' : 'Already have an account? Sign in'}
            </button>}
            {authMode === 'signin' && <button type="button" className="auth-switch" onClick={() => setAuthMode('cashier-signup')}>Have a cashier invitation? Join a shop</button>}
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">{t.appTitle}</p>
          <h1>{shopProfile.shopName}</h1>
        </div>
        <div className="header-actions">
          <button type="button" className="sync-button" onClick={() => void syncNow()}>
            {syncStatus === 'syncing' ? `${t.sync}…` : t.sync}
          </button>
          <button type="button" className={`low-stock-alert ${restockCandidates.length > 0 ? 'has-alerts' : ''}`} onClick={() => setActiveTab('stock')} aria-label={`${t.lowStockAlert}: ${restockCandidates.length}`}>
            <Bell size={17} />
            {restockCandidates.length > 0 && <span>{restockCandidates.length}</span>}
          </button>
          <select
            aria-label={t.language}
            value={locale}
            onChange={(event) => setLocale(event.target.value as 'en' | 'sw')}
            className="locale-select"
          >
            <option value="en">{t.english}</option>
            <option value="sw">{t.kiswahili}</option>
          </select>
          <button type="button" className="avatar-button" aria-label={t.openSettings} onClick={openSettings}>
            <CircleDollarSign size={18} />
          </button>
        </div>
      </header>

      <div className="sync-strip">
        <div>
          <span className="status-label">Session</span>
          <strong>{session ? session.name : 'Guest'}</strong>
        </div>
        <div className="sync-status-block">
          <span className={`status-pill ${syncStatus}`}>{syncStatus}</span>
          <small>{pendingSyncCount} queued</small>
        </div>
        {session ? (
          <button type="button" className="logout-button" onClick={logout}>Logout</button>
        ) : (
          <button type="button" className="logout-button" onClick={() => { setAuthMode('signin'); void logout() }}>Sign out</button>
        )}
      </div>

      {lastSyncedAt && (
        <div className="last-sync">Last sync: {new Date(lastSyncedAt).toLocaleString()}</div>
      )}

      {showSettings && (
        <div className="settings-panel" role="dialog" aria-label={t.profile}>
          <div className="settings-header">
            <h2>{t.profile}</h2>
            <button type="button" className="settings-close" aria-label="Close settings" onClick={() => setShowSettings(false)}>×</button>
          </div>
          <div className="settings-form">
            <div className="settings-status"><span>Access level</span><strong>{session.role}</strong><small>{session.email ?? ''}</small></div>
            {session.role === 'owner' && <>
              <input aria-label={t.shopName} value={profileForm.shopName} onChange={(event) => setProfileForm({ ...profileForm, shopName: event.target.value })} />
              <input aria-label={t.ownerName} value={profileForm.ownerName} onChange={(event) => setProfileForm({ ...profileForm, ownerName: event.target.value })} />
              <input aria-label={t.phoneNumber} inputMode="tel" value={profileForm.phone} onChange={(event) => setProfileForm({ ...profileForm, phone: event.target.value })} />
            </>}
            <label className="threshold-field">
              <span>{t.lowStockThreshold}</span>
              <div>
                <input aria-label={t.lowStockThreshold} type="number" min="0" step="1" value={lowStockThresholdForm} onChange={(event) => setLowStockThresholdForm(event.target.value)} />
                <small>{t.unitsLeft}</small>
              </div>
            </label>
            <div className="settings-status"><span>{t.sync}</span><strong>{syncStatus}</strong><small>{pendingSyncCount} queued</small></div>
            {session.role === 'owner' && <>
              <button type="button" className="primary-action" onClick={handleProfileUpdate}>{t.updateProfile}</button>
              <div className="cashier-invite">
                <strong>Invite a cashier</strong>
                <span>Cashiers can sell, but cannot change shop settings.</span>
                <input aria-label="Cashier email" type="email" placeholder="cashier@example.com" value={cashierEmail} onChange={(event) => setCashierEmail(event.target.value)} />
                <button type="button" className="inline-button" disabled={authBusy} onClick={handleInviteCashier}>Create invitation</button>
                {inviteMessage && <small role="status">{inviteMessage}</small>}
              </div>
            </>}
            <button type="button" className="settings-logout" onClick={() => { logout(); setShowSettings(false) }}>Logout</button>
          </div>
        </div>
      )}

      {activeTab === 'sell' && (
        <>
          <main className="content-card">
            <div className="search-box">
              <input
                aria-label={t.searchProducts}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={t.searchProducts}
              />
              <ArrowRight size={16} />
            </div>

            {heldCarts.length > 0 && (
              <section className="held-cart-strip" aria-label={t.heldCarts}>
                {heldCarts.map((heldCart) => (
                  <div className="held-cart-chip" key={heldCart.id}>
                    <button type="button" onClick={() => void resumeHeldCart(heldCart.id)}>
                      <strong>{heldCart.label}</strong>
                      <span>KES {heldCart.total.toLocaleString('en-KE')}</span>
                    </button>
                    <button type="button" aria-label={`Delete ${heldCart.label}`} onClick={() => void deleteHeldCart(heldCart.id)}>×</button>
                  </div>
                ))}
              </section>
            )}

            {quickSellProducts.length > 0 && !searchTerm && (
              <section className="quick-sell-row" aria-label={t.quickSellRow}>
                {quickSellProducts.map((product) => (
                  <button type="button" key={product.id} className="quick-sell-chip" onClick={() => addToCart(product)}>
                    <strong>{product.name}</strong>
                    <span>KES {product.selling_price}</span>
                  </button>
                ))}
              </section>
            )}

            <div className="expense-entry">
              <input aria-label="Expense title" placeholder={t.expenses} value={expenseTitle} onChange={(event) => setExpenseTitle(event.target.value)} />
              <input aria-label={t.amount} placeholder={t.amount} inputMode="numeric" value={expenseAmount} onChange={(event) => setExpenseAmount(event.target.value)} />
              <select aria-label={t.category} value={expenseCategory} onChange={(event) => setExpenseCategory(event.target.value as typeof expenseCategory)}>
                <option value="other">Other</option>
                <option value="transport">Transport</option>
                <option value="rent">Rent</option>
                <option value="airtime">Airtime</option>
                <option value="electricity">Electricity</option>
                <option value="water">Water</option>
                <option value="wages">Wages</option>
                <option value="cash_drop">Cash drop</option>
              </select>
              <select aria-label="Payment method" value={expensePayment} onChange={(event) => setExpensePayment(event.target.value as typeof expensePayment)}>
                <option value="cash">Cash</option>
                <option value="mpesa">M-Pesa</option>
              </select>
              <button type="button" className="inline-button" onClick={handleAddExpense}><Plus size={16} />{t.save}</button>
            </div>

            <section className="summary-grid">
              <article className="stat-card sales">
                <span>{t.totalSales}</span>
                <strong>KES {cartTotal.toLocaleString('en-KE')}</strong>
              </article>
              <article className="stat-card profit">
                <span>{t.profit}</span>
                <strong>KES {(cartTotal * 0.23).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}</strong>
              </article>
            </section>

            <section className="product-grid" aria-label="Products">
              {visibleProducts.map((product) => {
                const isLowStock = product.stock <= lowStockThreshold
                const isOut = product.stock === 0

                return (
                  <button
                    type="button"
                    key={product.id}
                    className="product-card"
                    onClick={() => addToCart(product)}
                    aria-label={`Add ${product.name} to sale`}
                  >
                    <div className="product-mark"><Box size={19} strokeWidth={1.8} /></div>
                    <div className="product-info">
                      <strong>{product.name}</strong>
                      <span>{product.denomination && product.denomination !== 'unit' ? `${product.denomination} | ` : ''}KES {product.selling_price}</span>
                    </div>
                    <span className={`stock-badge ${isOut ? 'danger' : isLowStock ? 'normal' : 'ok'}`}>
                      {product.stock}
                    </span>
                  </button>
                )
              })}
            </section>
          </main>

          <div className="checkout-bar">
            <div>
              <span>{cartCount} {t.items}</span>
              <strong>KES {cartTotal.toLocaleString('en-KE')}</strong>
            </div>
            <div className="checkout-actions">
              <button type="button" className="park-button" onClick={() => void parkCart()} disabled={cart.length === 0 || heldCarts.length >= 5}>{t.park}</button>
              <button type="button" onClick={handleCheckout} disabled={cart.length === 0}>{t.sellAction}</button>
            </div>
          </div>

          {lastSaleMessage && (
            <div className="sale-message" role="status">
              {lastSaleMessage.startsWith('Sale #')
                ? `${locale === 'sw' ? t.saleComplete : 'Sale complete'} #${lastSaleMessage.split('#')[1].split(' ')[0]}`
                : locale === 'sw' ? t.checkoutEmpty : lastSaleMessage}
              {lastSaleReceipt && (
                <button type="button" className="receipt-button" onClick={() => void handleShareReceipt()}>
                  {t.shareReceipt}
                </button>
              )}
              {receiptMessage && <small>{receiptMessage}</small>}
            </div>
          )}
        </>
      )}

      {activeTab === 'stock' && (
        <main className="panel-card">
          <div className="panel-header">
            <h2>{t.stock}</h2>
            <button type="button" className={`low-stock-summary ${restockCandidates.length > 0 ? 'has-alerts' : ''}`} onClick={() => document.querySelector('.restock-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              <Bell size={15} /> {restockCandidates.length} {t.lowStock}
            </button>
          </div>

          <div className="stock-entry">
            <input aria-label="Product name" placeholder="Product name" value={newProductName} onChange={(event) => setNewProductName(event.target.value)} />
            <input aria-label="Selling price" inputMode="numeric" placeholder="Selling price" value={newProductPrice} onChange={(event) => setNewProductPrice(event.target.value)} />
            <input aria-label="Opening stock" inputMode="numeric" placeholder="Opening stock" value={newProductStock} onChange={(event) => setNewProductStock(event.target.value)} />
            <select aria-label="Denomination" value={newProductDenomination} onChange={(event) => setNewProductDenomination(event.target.value as typeof newProductDenomination)}>
              <option value="quarter">1/4 kg</option>
              <option value="half">1/2 kg</option>
              <option value="three-quarter">3/4 kg</option>
              <option value="full">1 kg</option>
              <option value="unit">Unit</option>
            </select>
            <button type="button" className="inline-button" onClick={handleCreateProduct}><Plus size={16} />{t.addProduct}</button>
          </div>

          <section className="restock-section">
            <div className="restock-header">
              <h3>{t.restockList}</h3>
              <select aria-label="Restock cover days" value={restockCoverDays} onChange={(event) => setRestockCoverDays(Number(event.target.value))}>
                <option value="3">3 days</option>
                <option value="7">7 days</option>
                <option value="14">14 days</option>
              </select>
            </div>
            {restockCandidates.length === 0 ? (
              <span className="restock-empty">No products need restocking.</span>
            ) : (
              <>
                {restockCandidates.map((product) => {
                  const suggested = Math.max(lowStockThreshold * 2 - product.stock, 1)
                  const quantity = restockQuantities[product.id] ?? String(suggested)
                  return (
                    <div className="restock-row" key={product.id}>
                      <div>
                        <strong>{product.name}</strong>
                        <span>{product.stock} left · {t.suggested} {suggested}</span>
                      </div>
                      <input aria-label={`Restock quantity for ${product.name}`} inputMode="numeric" value={quantity} onChange={(event) => setRestockQuantities((current) => ({ ...current, [product.id]: event.target.value }))} />
                      <button type="button" aria-label={`${t.received} ${product.name}`} onClick={() => { void receiveStock(product.id, Number(quantity)); setRestockQuantities((current) => ({ ...current, [product.id]: '' })) }}><ArrowUp size={16} /></button>
                    </div>
                  )
                })}
                <div className="restock-total">{t.estimatedCost}: KES {restockTotal.toLocaleString('en-KE')} · {restockCoverDays} days</div>
              </>
            )}
          </section>

          <div className="stock-list">
            {products.map((product) => (
              <div key={product.id} className="stock-row">
                <div>
                  <strong>{product.name}</strong>
                  <span>{product.stock} {product.unit}</span>
                </div>
                <div className="row-actions">
                  <input
                    className="stock-quantity"
                    aria-label={`Receive stock for ${product.name}`}
                    inputMode="numeric"
                    placeholder="+qty"
                    value={stockReceipt[product.id] ?? ''}
                    onChange={(event) => setStockReceipt((current) => ({ ...current, [product.id]: event.target.value }))}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        void receiveStock(product.id, Number(stockReceipt[product.id]))
                        setStockReceipt((current) => ({ ...current, [product.id]: '' }))
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="receive-button"
                    aria-label={`Receive stock for ${product.name}`}
                    onClick={() => {
                      void receiveStock(product.id, Number(stockReceipt[product.id]))
                      setStockReceipt((current) => ({ ...current, [product.id]: '' }))
                    }}
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button type="button" onClick={() => addToCart(product)} aria-label={`Add ${product.name} to cart`}>
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </main>
      )}

      {activeTab === 'deni' && (
        <main className="panel-card">
          <div className="panel-header">
            <h2>{t.debts}</h2>
            <button type="button" className="inline-button" onClick={handleAddDebt}>
              <Plus size={16} />
              {t.addDebt}
            </button>
          </div>

          <div className="debt-total">{t.debtTotal}: KES {debtTotal.toLocaleString('en-KE')}</div>

          <div className="debt-entry">
            <input aria-label="Customer name" placeholder="Customer name" value={debtCustomer} onChange={(event) => setDebtCustomer(event.target.value)} />
            <input aria-label="Mobile number" placeholder="Mobile number" inputMode="tel" value={debtPhone} onChange={(event) => setDebtPhone(event.target.value)} />
            <select aria-label="Product taken" value={debtProductId} onChange={(event) => setDebtProductId(event.target.value)}>
              {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
            </select>
            <input aria-label="Quantity taken" placeholder="Qty" inputMode="numeric" value={debtQuantity} onChange={(event) => setDebtQuantity(event.target.value)} />
            <input aria-label={t.creditLimit} placeholder={t.creditLimit} inputMode="numeric" value={debtLimit} onChange={(event) => setDebtLimit(event.target.value)} />
            <button type="button" className="inline-button" onClick={handleAddDebt}><Plus size={16} />{t.addDebt}</button>
          </div>

          {debtMessage && <div className="debt-message" role="alert">{debtMessage}</div>}

          <div className="debt-list">
            {debts.map((debt) => {
              const debtLimitValue = creditLimits[debt.phone]
              const outstandingBalance = Math.max(debt.amount - debt.paid, 0)
              const creditUsage = debtLimitValue && debtLimitValue > 0 ? Math.min(outstandingBalance / debtLimitValue, 1) : 0
              const creditState = debtLimitValue && outstandingBalance > debtLimitValue ? 'over' : creditUsage > 0.8 ? 'warning' : 'normal'
              return (
                <div key={debt.id} className="debt-row">
                  <div>
                    <strong>{debt.customer}</strong>
                    <span>{debt.phone} · {debt.items.length ? debt.items.map((item) => `${item.productName} x${item.qty}`).join(', ') : debt.status}</span>
                    <small>{t.outstanding}: KES {outstandingBalance.toLocaleString('en-KE')} / {debtLimitValue === null || debtLimitValue === undefined ? '∞' : `KES ${debtLimitValue.toLocaleString('en-KE')}`}</small>
                    {debtLimitValue !== null && debtLimitValue !== undefined && <div className="credit-progress" aria-label={`${Math.round(creditUsage * 100)}% credit used`}><span className={creditState} style={{ width: `${Math.max(creditUsage * 100, debtLimitValue && outstandingBalance > debtLimitValue ? 100 : 0)}%` }} /></div>}
                    {debt.amount > debt.paid && (
                      <div className="payment-entry">
                        <input aria-label={`${t.payment} for ${debt.customer}`} inputMode="numeric" placeholder={t.payment} value={debtPayments[debt.id] ?? ''} onChange={(event) => setDebtPayments((current) => ({ ...current, [debt.id]: event.target.value }))} />
                        <select aria-label={`Payment method for ${debt.customer}`} value={debtPaymentMethod} onChange={(event) => setDebtPaymentMethod(event.target.value as typeof debtPaymentMethod)}>
                          <option value="cash">Cash</option>
                          <option value="mpesa">M-Pesa</option>
                        </select>
                        <button type="button" onClick={() => { void payDebt(debt.id, Number(debtPayments[debt.id]), debtPaymentMethod); setDebtPayments((current) => ({ ...current, [debt.id]: '' })) }}>{t.recordPayment}</button>
                      </div>
                    )}
                  </div>
                <div className="debt-amount">
                  <strong>KES {Math.max(debt.amount - debt.paid, 0).toLocaleString('en-KE')}</strong>
                  <span>{debt.paid} paid</span>
                </div>
                </div>
              )
            })}
          </div>
        </main>
      )}

      {activeTab === 'reports' && (
        <main className="panel-card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">{t.dashboard}</p>
              <h2>{t.reports}</h2>
            </div>
            <div className="report-actions">
              <label className="date-filter">
                <CalendarDays size={15} />
                <span className="sr-only">{t.reportDate}</span>
                <input type="date" value={reportDate} onChange={(event) => void setReportDate(event.target.value)} />
              </label>
              <button type="button" className="inline-button" onClick={() => setShowCloseDay(true)} disabled={cashSession?.status !== 'open'}>
                <Check size={16} />
                {cashSession?.status === 'open' ? t.closeDay : t.today}
              </button>
            </div>
          </div>

          {showCloseDay && cashSession?.status === 'open' && (
            <div className="close-day-panel">
              <strong>{t.closeDay}</strong>
              <span>{t.expectedCash}: KES {expectedCash.toLocaleString('en-KE')}</span>
              <input aria-label={t.countedCash} placeholder={t.countedCash} inputMode="numeric" value={countedCash} onChange={(event) => setCountedCash(event.target.value)} />
              <input aria-label={t.closeNote} placeholder={t.closeNote} value={closeNote} onChange={(event) => setCloseNote(event.target.value)} />
              <button type="button" className="inline-button" onClick={handleCloseDay}>{t.close}</button>
            </div>
          )}

          {cashSession?.status === 'closed' && cashSession.variance !== undefined && (
            <div className="close-result" role="status">
              <strong>{t.variance}: KES {cashSession.variance.toLocaleString('en-KE')}</strong>
              <span>{Math.abs(cashSession.variance) <= Math.max(expectedCash * 0.005, 50) ? t.okayVariance : `${t.variance}: KES ${Math.abs(cashSession.variance).toLocaleString('en-KE')}`}</span>
            </div>
          )}

          <div className="reports-grid">
            <article className="report-card">
              <span>{t.totalSales}</span>
              <strong>KES {reportSummary.sales.toLocaleString('en-KE')}</strong>
            </article>
            <article className="report-card alt">
              <span>{t.profit}</span>
              <strong>KES {reportSummary.profit.toLocaleString('en-KE')}</strong>
            </article>
            <article className="report-card expense-report">
              <span>{t.expenses}</span>
              <strong>KES {reportSummary.expenses.toLocaleString('en-KE')}</strong>
            </article>
          </div>
          <div className="report-detail">{reportSummary.transactions} {t.transactionsToday} · Net KES {reportSummary.net.toLocaleString('en-KE')}</div>
        </main>
      )}

      {cart.length > 0 && activeTab === 'sell' && (
        <div className="cart-panel">
          <div className="cart-header">
            <h3>{t.cart}</h3>
            <button type="button" onClick={clearCart} aria-label="Clear cart">
              <Trash2 size={14} />
            </button>
          </div>
          {cart.map((item) => (
            <div key={item.productId} className="cart-item">
              <div>
                <strong>{item.name}</strong>
                <span>{item.qty} × KES {item.unitPrice}</span>
              </div>
              <div className="cart-controls">
                <button type="button" aria-label={`Decrease ${item.name}`} onClick={() => decrementCartItem(item.productId)}>
                  −
                </button>
                <button type="button" aria-label={`Increase ${item.name}`} onClick={() => incrementCartItem(item.productId)}>
                  +
                </button>
                <button type="button" aria-label={`Remove ${item.name}`} onClick={() => removeCartItem(item.productId)}>
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <nav className="bottom-nav" aria-label="Main navigation">
        {tabs.map(({ labelKey, icon: Icon, key }) => (
          <button
            type="button"
            key={labelKey}
            className={`nav-item ${activeTab === key ? 'active' : ''}`}
            onClick={() => setActiveTab(key)}
            aria-label={t[labelKey]}
          >
            <Icon size={18} />
            <span>{t[labelKey]}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

export default App
