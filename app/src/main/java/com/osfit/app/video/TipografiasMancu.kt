package com.osfit.app.video

import android.content.Context
import android.graphics.Typeface
import androidx.core.content.res.ResourcesCompat
import com.osfit.app.R

class TipografiasMancu(context: Context) {
    val titulo: Typeface = ResourcesCompat.getFont(context, R.font.lilita_one) ?: Typeface.DEFAULT_BOLD
    val mano: Typeface = ResourcesCompat.getFont(context, R.font.patrick_hand) ?: Typeface.DEFAULT
}
