import { useState, useEffect, useMemo } from 'react'
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { format, subDays, differenceInDays, parseISO, startOfWeek, isAfter, isBefore, addDays } from 'date-fns'
import { de } from 'date-fns/locale'
import './App.css'

const DEFAULT_EXERCISES = {
  'Brust': ['Bankdrücken', 'Schrägbankdrücken', 'Brustpresse', 'Flys', 'Kabelzug'],
  'Rücken': ['Latzug', 'Rudern', 'Klimmzüge', 'Kreuzheben', 'Face Pulls'],
  'Schultern': ['Schulterdrücken', 'Seitheben', 'Frontheben', 'Reverse Flys'],
  'Arme': ['Bizeps Curls', 'Trizeps Dips', 'Hammer Curls', 'Trizeps Pushdown'],
  'Beine': ['Kniebeugen', 'Beinpresse', 'Ausfallschritte', 'Beinstrecker', 'Wadenheben'],
  'Core': ['Crunches', 'Planks', 'Russian Twists', 'Beinheben']
}

function App() {
  const [workouts, setWorkouts] = useState(() => {
    const saved = localStorage.getItem('fitness-workouts-v2')
    return saved ? JSON.parse(saved) : []
  })

  const [customExercises, setCustomExercises] = useState(() => {
    const saved = localStorage.getItem('fitness-custom-exercises')
    return saved ? JSON.parse(saved) : {}
  })

  const [bodyWeight, setBodyWeight] = useState(() => {
    const saved = localStorage.getItem('fitness-bodyweight')
    return saved ? JSON.parse(saved) : []
  })

  const [goals, setGoals] = useState(() => {
    const saved = localStorage.getItem('fitness-goals')
    return saved ? JSON.parse(saved) : { weekly: 4, monthly: 16 }
  })

  const [view, setView] = useState('dashboard')
  const [timeFilter, setTimeFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [showExerciseModal, setShowExerciseModal] = useState(false)
  const [showWeightModal, setShowWeightModal] = useState(false)
  const [showGoalsModal, setShowGoalsModal] = useState(false)
  const [editingWorkout, setEditingWorkout] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState('Brust')
  const [selectedExercise, setSelectedExercise] = useState('')
  const [currentDate, setCurrentDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [sets, setSets] = useState([{ weight: '', reps: '' }])
  const [newExerciseName, setNewExerciseName] = useState('')
  const [newExerciseCategory, setNewExerciseCategory] = useState('Brust')
  const [newBodyWeight, setNewBodyWeight] = useState('')
  const [selectedProgressExercise, setSelectedProgressExercise] = useState('')

  const allExercises = useMemo(() => {
    const merged = { ...DEFAULT_EXERCISES }
    Object.keys(customExercises).forEach(cat => {
      merged[cat] = [...(merged[cat] || []), ...customExercises[cat]]
    })
    return merged
  }, [customExercises])

  const categories = Object.keys(allExercises)

  useEffect(() => {
    localStorage.setItem('fitness-workouts-v2', JSON.stringify(workouts))
  }, [workouts])

  useEffect(() => {
    localStorage.setItem('fitness-custom-exercises', JSON.stringify(customExercises))
  }, [customExercises])

  useEffect(() => {
    localStorage.setItem('fitness-bodyweight', JSON.stringify(bodyWeight))
  }, [bodyWeight])

  useEffect(() => {
    localStorage.setItem('fitness-goals', JSON.stringify(goals))
  }, [goals])

  useEffect(() => {
    if (selectedCategory && allExercises[selectedCategory]?.length > 0) {
      setSelectedExercise(allExercises[selectedCategory][0])
    }
  }, [selectedCategory, allExercises])

  const filteredWorkouts = useMemo(() => {
    if (timeFilter === 'all') return workouts
    const days = timeFilter === '7' ? 7 : timeFilter === '30' ? 30 : 90
    const cutoff = subDays(new Date(), days)
    return workouts.filter(w => isAfter(parseISO(w.date), cutoff))
  }, [workouts, timeFilter])

  const stats = useMemo(() => {
    const uniqueDates = [...new Set(filteredWorkouts.map(w => w.date))].sort()
    const totalWorkouts = uniqueDates.length

    // Calculate streak
    let streak = 0
    const today = format(new Date(), 'yyyy-MM-dd')
    const allDates = [...new Set(workouts.map(w => w.date))].sort().reverse()

    if (allDates.length > 0) {
      let checkDate = allDates.includes(today) ? today : format(subDays(new Date(), 1), 'yyyy-MM-dd')
      for (const date of allDates) {
        if (date === checkDate) {
          streak++
          checkDate = format(subDays(parseISO(checkDate), 1), 'yyyy-MM-dd')
        } else if (isBefore(parseISO(date), parseISO(checkDate))) {
          break
        }
      }
    }

    // Personal records
    const records = {}
    workouts.forEach(w => {
      w.sets.forEach(s => {
        const key = w.exercise
        const volume = s.weight * s.reps
        if (!records[key] || volume > records[key].volume) {
          records[key] = { weight: s.weight, reps: s.reps, volume, date: w.date }
        }
      })
    })

    // Category distribution
    const distribution = {}
    filteredWorkouts.forEach(w => {
      const cat = Object.keys(allExercises).find(c => allExercises[c].includes(w.exercise)) || 'Sonstige'
      distribution[cat] = (distribution[cat] || 0) + 1
    })

    // Weekly goal progress
    const thisWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
    const thisWeekWorkouts = [...new Set(workouts.filter(w =>
      isAfter(parseISO(w.date), subDays(thisWeekStart, 1))
    ).map(w => w.date))].length

    return { totalWorkouts, streak, records, distribution, thisWeekWorkouts }
  }, [filteredWorkouts, workouts, allExercises])

  const chartData = useMemo(() => {
    // Weekly volume data
    const weeklyVolume = {}
    workouts.forEach(w => {
      const weekStart = format(startOfWeek(parseISO(w.date), { weekStartsOn: 1 }), 'dd.MM')
      const volume = w.sets.reduce((sum, s) => sum + (s.weight * s.reps), 0)
      weeklyVolume[weekStart] = (weeklyVolume[weekStart] || 0) + volume
    })
    const volumeData = Object.entries(weeklyVolume).map(([week, volume]) => ({ week, volume })).slice(-12)

    // Activity data (last 90 days)
    const activityData = []
    for (let i = 89; i >= 0; i--) {
      const date = format(subDays(new Date(), i), 'yyyy-MM-dd')
      const count = workouts.filter(w => w.date === date).length
      activityData.push({ date: format(parseISO(date), 'dd.MM'), count })
    }

    return { volumeData, activityData }
  }, [workouts])

  const exerciseProgressData = useMemo(() => {
    if (!selectedProgressExercise) return []
    return workouts
      .filter(w => w.exercise === selectedProgressExercise)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(w => ({
        date: format(parseISO(w.date), 'dd.MM'),
        maxWeight: Math.max(...w.sets.map(s => s.weight)),
        totalVolume: w.sets.reduce((sum, s) => sum + (s.weight * s.reps), 0)
      }))
  }, [workouts, selectedProgressExercise])

  const allUsedExercises = useMemo(() => {
    return [...new Set(workouts.map(w => w.exercise))]
  }, [workouts])

  const addSet = () => setSets([...sets, { weight: '', reps: '' }])

  const removeSet = (index) => {
    if (sets.length > 1) setSets(sets.filter((_, i) => i !== index))
  }

  const updateSet = (index, field, value) => {
    const newSets = [...sets]
    newSets[index][field] = value
    setSets(newSets)
  }

  const saveWorkout = () => {
    const validSets = sets.filter(s => s.weight && s.reps)
    if (validSets.length === 0) return

    const entry = {
      id: editingWorkout?.id || Date.now(),
      date: currentDate,
      exercise: selectedExercise,
      category: selectedCategory,
      sets: validSets.map(s => ({ weight: parseFloat(s.weight), reps: parseInt(s.reps) }))
    }

    if (editingWorkout) {
      setWorkouts(workouts.map(w => w.id === editingWorkout.id ? entry : w))
    } else {
      setWorkouts([...workouts, entry])
    }

    resetForm()
  }

  const resetForm = () => {
    setSets([{ weight: '', reps: '' }])
    setEditingWorkout(null)
    setShowModal(false)
  }

  const editWorkout = (workout) => {
    setEditingWorkout(workout)
    setCurrentDate(workout.date)
    setSelectedCategory(workout.category || 'Brust')
    setSelectedExercise(workout.exercise)
    setSets(workout.sets.map(s => ({ weight: s.weight.toString(), reps: s.reps.toString() })))
    setShowModal(true)
  }

  const deleteWorkout = (id) => {
    if (confirm('Eintrag wirklich löschen?')) {
      setWorkouts(workouts.filter(w => w.id !== id))
    }
  }

  const addCustomExercise = () => {
    if (!newExerciseName.trim()) return
    setCustomExercises(prev => ({
      ...prev,
      [newExerciseCategory]: [...(prev[newExerciseCategory] || []), newExerciseName.trim()]
    }))
    setNewExerciseName('')
    setShowExerciseModal(false)
  }

  const deleteCustomExercise = (category, exercise) => {
    setCustomExercises(prev => ({
      ...prev,
      [category]: prev[category].filter(e => e !== exercise)
    }))
  }

  const addBodyWeightEntry = () => {
    if (!newBodyWeight) return
    setBodyWeight([...bodyWeight, {
      date: format(new Date(), 'yyyy-MM-dd'),
      weight: parseFloat(newBodyWeight)
    }])
    setNewBodyWeight('')
    setShowWeightModal(false)
  }

  const exportCSV = () => {
    const headers = ['Datum', 'Übung', 'Kategorie', 'Satz', 'Gewicht (kg)', 'Wiederholungen']
    const rows = workouts.flatMap(w =>
      w.sets.map((s, i) => [w.date, w.exercise, w.category || '', i + 1, s.weight, s.reps])
    )
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fitness-export-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
  }

  const groupedWorkouts = filteredWorkouts.reduce((acc, w) => {
    if (!acc[w.date]) acc[w.date] = []
    acc[w.date].push(w)
    return acc
  }, {})

  const sortedDates = Object.keys(groupedWorkouts).sort((a, b) => new Date(b) - new Date(a))

  return (
    <div className="app">
      <header className="header">
        <h1>Fitness Tracker</h1>
        <p className="subtitle">Dein persönlicher Trainingsbegleiter</p>
      </header>

      <nav className="nav-tabs">
        {['dashboard', 'history', 'progress'].map(tab => (
          <button
            key={tab}
            className={view === tab ? 'active' : ''}
            onClick={() => setView(tab)}
          >
            {tab === 'dashboard' ? 'Dashboard' : tab === 'history' ? 'Verlauf' : 'Fortschritt'}
          </button>
        ))}
      </nav>

      {view === 'dashboard' && (
        <div className="dashboard">
          <div className="stats-grid">
            <div className="stat-card glass">
              <span className="stat-label">Trainings</span>
              <span className="stat-value mono">{stats.totalWorkouts}</span>
              <span className="stat-sub">im gewählten Zeitraum</span>
            </div>
            <div className="stat-card glass streak">
              <span className="stat-label">Streak</span>
              <span className="stat-value mono">{stats.streak}</span>
              <span className="stat-sub">Tage in Folge</span>
            </div>
            <div className="stat-card glass">
              <span className="stat-label">Wochenziel</span>
              <span className="stat-value mono">{stats.thisWeekWorkouts}/{goals.weekly}</span>
              <span className="stat-sub">diese Woche</span>
            </div>
            <div className="stat-card glass clickable" onClick={() => setShowGoalsModal(true)}>
              <span className="stat-label">Monatsziel</span>
              <span className="stat-value mono">{goals.monthly}</span>
              <span className="stat-sub">Trainings/Monat</span>
            </div>
          </div>

          <div className="section">
            <h2>Persönliche Rekorde</h2>
            <div className="records-grid">
              {Object.entries(stats.records).slice(0, 6).map(([exercise, record]) => (
                <div key={exercise} className="record-card glass">
                  <span className="record-exercise">{exercise}</span>
                  <span className="record-value mono">{record.weight}kg × {record.reps}</span>
                  <span className="record-date">{format(parseISO(record.date), 'dd.MM.yy')}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="section">
            <h2>Trainingsverteilung</h2>
            <div className="distribution">
              {Object.entries(stats.distribution).map(([cat, count]) => {
                const total = Object.values(stats.distribution).reduce((a, b) => a + b, 0)
                const percent = Math.round((count / total) * 100)
                return (
                  <div key={cat} className="dist-item">
                    <span className="dist-label">{cat}</span>
                    <div className="dist-bar-container">
                      <div className="dist-bar" style={{ width: `${percent}%` }}></div>
                    </div>
                    <span className="dist-value mono">{percent}%</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="section">
            <h2>Aktivität (90 Tage)</h2>
            <div className="chart-container glass">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData.activityData}>
                  <defs>
                    <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" stroke="#9ca3af" tick={{ fontSize: 10 }} interval={13} />
                  <YAxis stroke="#9ca3af" tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: '#1f2937', border: 'none', borderRadius: '8px' }} />
                  <Area type="monotone" dataKey="count" stroke="#8b5cf6" fill="url(#activityGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="quick-actions">
            <button className="action-btn primary" onClick={() => setShowModal(true)}>
              + Neues Training
            </button>
            <button className="action-btn" onClick={() => setShowWeightModal(true)}>
              Gewicht eintragen
            </button>
            <button className="action-btn" onClick={() => setShowExerciseModal(true)}>
              Übung hinzufügen
            </button>
            <button className="action-btn" onClick={exportCSV}>
              Export CSV
            </button>
          </div>
        </div>
      )}

      {view === 'history' && (
        <div className="history">
          <div className="filter-bar">
            {['7', '30', '90', 'all'].map(f => (
              <button
                key={f}
                className={`filter-chip ${timeFilter === f ? 'active' : ''}`}
                onClick={() => setTimeFilter(f)}
              >
                {f === 'all' ? 'Alles' : `${f} Tage`}
              </button>
            ))}
          </div>

          <button className="action-btn primary full-width" onClick={() => setShowModal(true)}>
            + Neues Training
          </button>

          {sortedDates.length === 0 ? (
            <p className="no-data">Keine Trainings im gewählten Zeitraum.</p>
          ) : (
            sortedDates.map(date => {
              const dayWorkouts = groupedWorkouts[date]
              const maxSets = Math.max(...dayWorkouts.map(w => w.sets.length))
              return (
                <div key={date} className="workout-day glass">
                  <h3>{format(parseISO(date), 'EEEE, d. MMMM yyyy', { locale: de })}</h3>
                  <div className="workout-table-container">
                    <table className="workout-table">
                      <thead>
                        <tr>
                          <th>Übung</th>
                          {[...Array(maxSets)].map((_, i) => (
                            <th key={i}>Satz {i + 1}</th>
                          ))}
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {dayWorkouts.map(workout => (
                          <tr key={workout.id}>
                            <td className="exercise-name">{workout.exercise}</td>
                            {[...Array(maxSets)].map((_, i) => (
                              <td key={i} className="set-cell">
                                {workout.sets[i] ? (
                                  <span className="set-data">
                                    <span className="weight mono">{workout.sets[i].weight}kg</span>
                                    <span className="reps">×{workout.sets[i].reps}</span>
                                  </span>
                                ) : '–'}
                              </td>
                            ))}
                            <td className="action-cell">
                              <button className="icon-btn" onClick={() => editWorkout(workout)} title="Bearbeiten">✎</button>
                              <button className="icon-btn delete" onClick={() => deleteWorkout(workout.id)} title="Löschen">✕</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {view === 'progress' && (
        <div className="progress-view">
          <div className="section">
            <h2>Übungs-Fortschritt</h2>
            <select
              className="select-input"
              value={selectedProgressExercise}
              onChange={(e) => setSelectedProgressExercise(e.target.value)}
            >
              <option value="">Übung wählen...</option>
              {allUsedExercises.map(ex => (
                <option key={ex} value={ex}>{ex}</option>
              ))}
            </select>

            {exerciseProgressData.length > 0 && (
              <div className="chart-container glass">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={exerciseProgressData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" stroke="#9ca3af" />
                    <YAxis yAxisId="left" stroke="#8b5cf6" />
                    <YAxis yAxisId="right" orientation="right" stroke="#06b6d4" />
                    <Tooltip contentStyle={{ background: '#1f2937', border: 'none', borderRadius: '8px' }} />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="maxWeight" name="Max Gewicht (kg)" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6' }} />
                    <Line yAxisId="right" type="monotone" dataKey="totalVolume" name="Volumen" stroke="#06b6d4" strokeWidth={2} dot={{ fill: '#06b6d4' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="section">
            <h2>Wöchentliches Volumen</h2>
            <div className="chart-container glass">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData.volumeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="week" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip contentStyle={{ background: '#1f2937', border: 'none', borderRadius: '8px' }} />
                  <Bar dataKey="volume" name="Volumen (kg×Wdh)" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {bodyWeight.length > 0 && (
            <div className="section">
              <h2>Körpergewicht</h2>
              <div className="chart-container glass">
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={bodyWeight.map(b => ({ ...b, date: format(parseISO(b.date), 'dd.MM') }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" domain={['dataMin - 2', 'dataMax + 2']} />
                    <Tooltip contentStyle={{ background: '#1f2937', border: 'none', borderRadius: '8px' }} />
                    <Line type="monotone" dataKey="weight" name="Gewicht (kg)" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Training Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => resetForm()}>
          <div className="modal glass" onClick={e => e.stopPropagation()}>
            <h2>{editingWorkout ? 'Training bearbeiten' : 'Neues Training'}</h2>

            <div className="form-group">
              <label>Datum</label>
              <input
                type="date"
                value={currentDate}
                onChange={(e) => setCurrentDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Kategorie</label>
              <div className="category-chips">
                {categories.map(cat => (
                  <button
                    key={cat}
                    className={`chip ${selectedCategory === cat ? 'active' : ''}`}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Übung</label>
              <select
                value={selectedExercise}
                onChange={(e) => setSelectedExercise(e.target.value)}
              >
                {allExercises[selectedCategory]?.map(ex => (
                  <option key={ex} value={ex}>{ex}</option>
                ))}
              </select>
            </div>

            <div className="sets-section">
              <label>Sätze</label>
              {sets.map((set, index) => (
                <div key={index} className="set-row">
                  <span className="set-num mono">{index + 1}</span>
                  <input
                    type="number"
                    placeholder="kg"
                    value={set.weight}
                    onChange={(e) => updateSet(index, 'weight', e.target.value)}
                  />
                  <span className="separator">×</span>
                  <input
                    type="number"
                    placeholder="Wdh"
                    value={set.reps}
                    onChange={(e) => updateSet(index, 'reps', e.target.value)}
                  />
                  <button className="icon-btn delete" onClick={() => removeSet(index)} disabled={sets.length === 1}>✕</button>
                </div>
              ))}
              <button className="action-btn secondary" onClick={addSet}>+ Satz</button>
            </div>

            <div className="modal-actions">
              <button className="action-btn" onClick={resetForm}>Abbrechen</button>
              <button className="action-btn primary" onClick={saveWorkout}>Speichern</button>
            </div>
          </div>
        </div>
      )}

      {/* Exercise Modal */}
      {showExerciseModal && (
        <div className="modal-overlay" onClick={() => setShowExerciseModal(false)}>
          <div className="modal glass" onClick={e => e.stopPropagation()}>
            <h2>Übung hinzufügen</h2>

            <div className="form-group">
              <label>Kategorie</label>
              <select value={newExerciseCategory} onChange={(e) => setNewExerciseCategory(e.target.value)}>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Name der Übung</label>
              <input
                type="text"
                value={newExerciseName}
                onChange={(e) => setNewExerciseName(e.target.value)}
                placeholder="z.B. Arnold Press"
              />
            </div>

            {Object.keys(customExercises).length > 0 && (
              <div className="custom-exercises-list">
                <label>Eigene Übungen</label>
                {Object.entries(customExercises).map(([cat, exercises]) =>
                  exercises.map(ex => (
                    <div key={ex} className="custom-exercise-item">
                      <span>{ex} <small>({cat})</small></span>
                      <button className="icon-btn delete" onClick={() => deleteCustomExercise(cat, ex)}>✕</button>
                    </div>
                  ))
                )}
              </div>
            )}

            <div className="modal-actions">
              <button className="action-btn" onClick={() => setShowExerciseModal(false)}>Schließen</button>
              <button className="action-btn primary" onClick={addCustomExercise}>Hinzufügen</button>
            </div>
          </div>
        </div>
      )}

      {/* Weight Modal */}
      {showWeightModal && (
        <div className="modal-overlay" onClick={() => setShowWeightModal(false)}>
          <div className="modal glass" onClick={e => e.stopPropagation()}>
            <h2>Körpergewicht eintragen</h2>

            <div className="form-group">
              <label>Gewicht (kg)</label>
              <input
                type="number"
                value={newBodyWeight}
                onChange={(e) => setNewBodyWeight(e.target.value)}
                placeholder="z.B. 75.5"
                step="0.1"
              />
            </div>

            <div className="modal-actions">
              <button className="action-btn" onClick={() => setShowWeightModal(false)}>Abbrechen</button>
              <button className="action-btn primary" onClick={addBodyWeightEntry}>Speichern</button>
            </div>
          </div>
        </div>
      )}

      {/* Goals Modal */}
      {showGoalsModal && (
        <div className="modal-overlay" onClick={() => setShowGoalsModal(false)}>
          <div className="modal glass" onClick={e => e.stopPropagation()}>
            <h2>Ziele setzen</h2>

            <div className="form-group">
              <label>Wöchentliches Ziel</label>
              <input
                type="number"
                value={goals.weekly}
                onChange={(e) => setGoals({ ...goals, weekly: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div className="form-group">
              <label>Monatliches Ziel</label>
              <input
                type="number"
                value={goals.monthly}
                onChange={(e) => setGoals({ ...goals, monthly: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div className="modal-actions">
              <button className="action-btn primary" onClick={() => setShowGoalsModal(false)}>Speichern</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
