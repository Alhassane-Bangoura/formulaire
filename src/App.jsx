import React, { useEffect, useState } from 'react'
import './App.css'
import { createClient } from '@supabase/supabase-js'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'

const schema = yup.object({
  bought: yup.string().oneOf(['oui', 'non']).required('Cette question est requise'),
  platforms: yup.array().when('bought', {
    is: 'oui',
    then: (s) => s.min(1, 'Choisissez au moins une plateforme'),
    otherwise: (s) => s.notRequired()
  }),
  platforms_other: yup.string().when('platforms', {
    is: (arr) => Array.isArray(arr) && arr.includes('autre'),
    then: (s) => s.required('Veuillez préciser'),
    otherwise: (s) => s.notRequired()
  }),
  advice: yup.string().max(500, 'Maximum 500 caractères').notRequired(),
  reasons: yup.array().when('bought', {
    is: 'non',
    then: (s) => s.min(1, 'Choisissez au moins une raison'),
    otherwise: (s) => s.notRequired()
  }),
  would_use: yup.string().oneOf(['oui', 'peut-etre', 'non']).required('Répondez à cette question'),
  reassurance: yup.array().notRequired()
})


function App() {
  const { register, handleSubmit, watch, formState: { errors, isValid }, getValues, reset } = useForm({
    resolver: yupResolver(schema),
    mode: 'onChange',
    defaultValues: {
      bought: '',
      platforms: [],
      platforms_other: '',
      reasons: [],
      would_use: '',
      reassurance: []
      , advice: ''
    }
  })

  const bought = watch('bought')
  const platforms = watch('platforms') || []
  const would_use = watch('would_use')
  const reassurance = watch('reassurance') || []
  const advice = watch('advice') || ''

  // Supabase client (set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env)
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  const supabase = createClient(supabaseUrl, supabaseKey)

  const [responses, setResponses] = useState([])
  const [notice, setNotice] = useState(null)
  const [currentStep, setCurrentStep] = useState(1) // 1 to 7 (Recap)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const [isSubmitting, setIsSubmitting] = useState(false)

  // Determine which step is next based on current step and logic
  const nextStep = () => {
    if (currentStep === 1) {
      if (bought === 'oui') setCurrentStep(2)
      else if (bought === 'non') setCurrentStep(3)
    } else if (currentStep === 2 || currentStep === 3) {
      setCurrentStep(4)
    } else if (currentStep < 7) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep === 4) {
      if (bought === 'oui') setCurrentStep(2)
      else if (bought === 'non') setCurrentStep(3)
    } else if (currentStep === 2 || currentStep === 3) {
      setCurrentStep(1)
    } else if (currentStep === 7) {
      setCurrentStep(6)
    } else if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  // Step validation
  const isStepValid = () => {
    if (currentStep === 1) return !!bought
    if (currentStep === 2) return platforms.length > 0 && (!platforms.includes('autre') || watch('platforms_other'))
    if (currentStep === 3) return (watch('reasons') || []).length > 0
    if (currentStep === 4) return !!would_use
    if (currentStep === 5) return true
    if (currentStep === 6) return true
    if (currentStep === 7) return true
    return false
  }


  const onSubmit = async (data) => {
    setIsSubmitting(true)
    try {
      const payload = {
        deja_achete_en_ligne: data.bought,
        plateformes_utilisees: data.platforms || [],
        autre_plateforme: data.platforms_other || null,
        raisons_non_achat: data.reasons || [],
        utiliserait_solution_guineenne: data.would_use,
        criteres_de_confiance: data.reassurance || [],
        conseils_ou_remarques: data.advice || null
      }

      const { error: insertError } = await supabase.from('survey_responses').insert([payload])
      if (insertError) throw insertError

      await fetchResponses()
      reset()
      setIsSubmitted(true)
      setNotice({ type: 'success', text: 'Merci — tes réponses ont bien été enregistrées.' })
      setTimeout(() => setNotice(null), 4500)
    } catch (err) {
      console.error('Insert error', err)
      setNotice({ type: 'error', text: `Erreur: ${err.message || 'Problème de connexion'}` })
      setTimeout(() => setNotice(null), 8000)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Logical mapping for a clean 1-2-3-4-5-6 flow
  const displayStep = currentStep === 3 ? 2 : (currentStep > 3 ? currentStep - 1 : currentStep)
  const progress = (displayStep / 6) * 100

  const fetchResponses = async () => {
    if (!supabaseUrl || !supabaseKey) return
    try {
      const { data, error } = await supabase.from('survey_responses').select('*').order('date_creation', { ascending: false }).limit(20)
      if (error) throw error
      setResponses(data || [])
    } catch (err) {
      console.error('Fetch responses error', err)
    }
  }

  useEffect(() => { fetchResponses() }, [])

  return (
    <div className="survey-wrapper">
      <div className="survey-card">
        {isSubmitted ? (
          <div className="step-fade-in" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <div style={{ fontSize: '5rem', marginBottom: '1.5rem' }}>✅</div>
            <h1 style={{ marginBottom: '1rem', fontSize: '2rem' }}>Merci pour votre participation !</h1>
            <p style={{ color: 'var(--text-muted)', lineHeight: '1.8', fontSize: '1.1rem' }}>
              Tes réponses ont bien été enregistrées. <br />
              Le sondage est maintenant terminé. À bientôt !
            </p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h1>Solution de sondage Guinéenne</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Étape {displayStep} sur 6</p>
              </div>
            </div>

            <div className="progress-bar-container">
              <div className="progress-bar" style={{ width: `${progress}%` }} />
            </div>

            {notice && (
              <div className={notice.type === 'success' ? 'toast-success' : 'toast-error'}>
                {notice.text}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)}>
              <div key={currentStep} className="step-fade-in">
                {currentStep === 1 && (
                  <div>
                    <label className="question-label">1. Est-ce que vous avez déjà acheté un produit en ligne ?</label>
                    <div className="choices">
                      <label><input type="radio" value="oui" {...register('bought')} /> Oui, j'ai l'habitude</label>
                      <label><input type="radio" value="non" {...register('bought')} /> Non, jamais pour l'instant</label>
                    </div>
                  </div>
                )}

                {currentStep === 2 && bought === 'oui' && (
                  <div>
                    <label className="question-label">2. Si oui, où ? (choix multiples)</label>
                    <div className="choices">
                      <label><input type="checkbox" value="facebook" {...register('platforms')} /> Facebook Marketplace</label>
                      <label><input type="checkbox" value="whatsapp" {...register('platforms')} /> Groupes WhatsApp</label>
                      <label><input type="checkbox" value="instagram" {...register('platforms')} /> Instagram Business</label>
                      <label><input type="checkbox" value="autre" {...register('platforms')} /> Autre plateforme</label>
                    </div>
                    {platforms.includes('autre') && (
                      <div style={{ marginTop: '0.5rem' }}>
                        <input className="field-input" {...register('platforms_other')} placeholder="Précisez la plateforme..." />
                        {errors.platforms_other && <div className="error-message">{errors.platforms_other.message}</div>}
                      </div>
                    )}
                  </div>
                )}

                {currentStep === 3 && bought === 'non' && (
                  <div>
                    <label className="question-label">2. Pourquoi n'avez-vous jamais acheté en ligne ? (choix possibles)</label>
                    <div className="choices">
                      <label><input type="checkbox" value="manque_confiance" {...register('reasons')} /> Manque de confiance</label>
                      <label><input type="checkbox" value="peur_arnaque" {...register('reasons')} /> Crainte des arnaques</label>
                      <label><input type="checkbox" value="livraison" {...register('reasons')} /> Problèmes de livraison</label>
                      <label><input type="checkbox" value="paiement" {...register('reasons')} /> Difficulté de paiement</label>
                      <label><input type="checkbox" value="voir_produit" {...register('reasons')} /> Besoin de voir le produit</label>
                    </div>
                  </div>
                )}

                {currentStep === 4 && (
                  <div>
                    <label className="question-label">3. Si une plateforme guinéenne sécurisée existait, est-ce que vous l’utiliseriez ?</label>
                    <div className="choices">
                      <label><input type="radio" value="oui" {...register('would_use')} /> Oui, absolument</label>
                      <label><input type="radio" value="peut-etre" {...register('would_use')} /> Peut-être, selon l'offre</label>
                      <label><input type="radio" value="non" {...register('would_use')} /> Non, ça ne m'intéresse pas</label>
                    </div>
                  </div>
                )}

                {currentStep === 5 && (
                  <div>
                    <label className="question-label">4. Qu'est-ce qui vous rassurerait le plus ?</label>
                    <div className="choices">
                      <label><input type="checkbox" value="paiement_securise" {...register('reassurance')} /> Paiement en ligne sécurisé</label>
                      <label><input type="checkbox" value="avis_clients" {...register('reassurance')} /> Avis et notes clients</label>
                      <label><input type="checkbox" value="paiement_livraison" {...register('reassurance')} /> Paiement à la réception</label>
                      <label><input type="checkbox" value="garantie_remboursement" {...register('reassurance')} /> Garantie satisfait ou remboursé</label>
                    </div>
                  </div>
                )}

                {currentStep === 6 && (
                  <div>
                    <label className="question-label">5. Un dernier conseil ou remarque ? (optionnel)</label>
                    <textarea {...register('advice')} placeholder="Partagez vos idées ici..." rows={3} />
                  </div>
                )}

                {currentStep === 7 && (
                  <div className="preview-section" style={{ background: 'rgba(99, 102, 241, 0.08)', borderColor: 'var(--primary)' }}>
                    <strong style={{ fontSize: '1.2rem', marginBottom: '1.5rem', color: '#fff' }}>Résumé de vos réponses</strong>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                      <div className="preview-item">Achat en ligne <strong>{bought === 'oui' ? '✅ Oui' : '❌ Non'}</strong></div>
                      <div className="preview-item">Solution Future <strong>{would_use === 'oui' ? '✅ Favorable' : (would_use || '—')}</strong></div>

                      {bought === 'oui' && platforms.length > 0 && <div className="preview-item">Plateformes <strong>{platforms.join(', ')}</strong></div>}
                      {bought === 'non' && (watch('reasons') || []).length > 0 && <div className="preview-item">Freins <strong>{(watch('reasons') || []).join(', ')}</strong></div>}

                      {(watch('reassurance') || []).length > 0 && <div className="preview-item">Confiance <strong>{(watch('reassurance') || []).join(', ')}</strong></div>}
                    </div>
                    {watch('advice') && (
                      <div className="preview-item" style={{ marginTop: '1.5rem', borderTop: '1px solid var(--card-border)', paddingTop: '1rem' }}>
                        Ma remarque <strong>"{watch('advice')}"</strong>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
                {currentStep > 1 && (
                  <button type="button" onClick={prevStep} className="submit-btn" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--card-border)' }}>
                    Retour
                  </button>
                )}

                {currentStep < 7 ? (
                  <button type="button" onClick={nextStep} className="submit-btn" disabled={!isStepValid()}>
                    Suivant
                  </button>
                ) : (
                  <button type="submit" className="submit-btn" disabled={isSubmitting}>
                    {isSubmitting ? 'Finalisation...' : '🚀 Confirmer et Envoyer'}
                  </button>
                )}
              </div>
            </form>
          </>
        )}

        <div className="responses-list">
          <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem', marginTop: '2rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Contributions Récentes</h3>
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '10px', width: '100%' }}>
            {responses.slice(0, 5).map(r => (
              <div key={r.id} style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', border: '1px solid var(--card-border)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                {r.deja_achete_en_ligne === 'oui' ? '✅ Acheteur' : 'Prospect'} • {new Date(r.date_creation).toLocaleDateString()}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App